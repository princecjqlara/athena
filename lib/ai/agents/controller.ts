/**
 * Controller Agent
 * 
 * Orchestrates the multi-agent system by:
 * - Determining reasoning depth based on query context
 * - Routing to appropriate specialist agents
 * - Synthesizing results from multiple agents
 * - Managing execution state and escalation
 */

import {
    AgentType,
    AgentContext,
    AgentRun,
    AgentExecutionStep,
    ControllerDecision,
    ControllerState,
    ToolOutput,
    AGENT_CONFIGS
} from './types';
import {
    createReasoningPlan,
    shouldEscalateDepth,
    ReasoningContext,
    ReasoningPlan
} from './adaptive-reasoning';
import { v4 as uuidv4 } from 'uuid';

export interface ControllerInput {
    query: string;
    queryType: 'analyze' | 'recommend' | 'explain' | 'predict' | 'compare' | 'diagnose';
    entityType?: string;
    entityId?: string;
    entityIds?: string[];
    context?: Record<string, unknown>;
    reasoningContext: ReasoningContext;
}

export interface ControllerOutput {
    success: boolean;
    result?: Record<string, unknown>;
    recommendations?: Array<Record<string, unknown>>;
    explanation?: string;
    confidence?: number;
    run: AgentRun;
    error?: string;
}

/**
 * Controller Agent class
 */
export class ControllerAgent {
    private state: ControllerState | null = null;
    private agentExecutors: Map<AgentType, (input: Record<string, unknown>) => Promise<ToolOutput>>;

    constructor() {
        this.agentExecutors = new Map();
        // Agent executors will be registered dynamically
    }

    /**
     * Register an agent executor
     */
    registerAgent(
        agentType: AgentType,
        executor: (input: Record<string, unknown>) => Promise<ToolOutput>
    ): void {
        this.agentExecutors.set(agentType, executor);
    }

    /**
     * Main entry point - process a query
     */
    async process(input: ControllerInput, context: AgentContext): Promise<ControllerOutput> {
        // Initialize run
        const run: AgentRun = {
            id: uuidv4(),
            context,
            trigger: 'user_query',
            triggerData: { query: input.query, queryType: input.queryType },
            steps: [],
            status: 'running',
            startedAt: new Date(),
            totalTokens: 0
        };

        // Create reasoning plan
        const plan = createReasoningPlan(input.reasoningContext);

        // Initialize state
        this.state = {
            run,
            currentStep: 0,
            gatheredData: {},
            decisions: [{
                nextAgents: plan.agents,
                reasoning: plan.reasoning,
                shouldContinue: true,
                depth: plan.depth
            }]
        };

        console.log(`[Controller] Starting run ${run.id} with ${plan.depth} depth`);
        console.log(`[Controller] Agents to invoke: ${plan.agents.join(', ')}`);

        try {
            // Execute agents in sequence/parallel based on dependencies
            const result = await this.executeAgents(input, plan);

            // Synthesize results
            const synthesized = this.synthesizeResults();

            run.status = 'completed';
            run.completedAt = new Date();
            run.result = synthesized;

            return {
                success: true,
                result: synthesized,
                recommendations: synthesized.recommendations as Array<Record<string, unknown>> | undefined,
                explanation: synthesized.explanation as string | undefined,
                confidence: synthesized.confidence as number | undefined,
                run
            };
        } catch (error) {
            run.status = 'failed';
            run.error = String(error);
            run.completedAt = new Date();

            return {
                success: false,
                error: String(error),
                run
            };
        }
    }

    /**
     * Execute agents according to the plan
     */
    private async executeAgents(input: ControllerInput, plan: ReasoningPlan): Promise<void> {
        if (!this.state) throw new Error('Controller state not initialized');

        // Group 1: Data validation (always first)
        if (plan.agents.includes('data_validator')) {
            await this.executeAgent('data_validator', {
                tool: 'check_data_completeness',
                entity_type: input.entityType || 'ad',
                entity_id: input.entityId
            });
        }

        // Check for early exit based on data quality
        const dataValidation = this.state.gatheredData['data_validator'];
        if (dataValidation && !(dataValidation as ToolOutput).success) {
            console.log('[Controller] Data validation failed, adding warning');
            this.state.gatheredData['warnings'] = ['Data quality issues detected'];
        }

        // Group 2: Performance analysis
        if (plan.agents.includes('performance_analyst')) {
            await this.executeAgent('performance_analyst', {
                tool: input.queryType === 'diagnose' ? 'find_anomalies' : 'detect_trends',
                entity_id: input.entityId,
                metric: (input.context?.metric as string) || 'roas',
                days: 14
            });
        }

        // Check for escalation
        const analysisResult = this.state.gatheredData['performance_analyst'] as ToolOutput | undefined;
        const anomalies = (analysisResult?.data?.anomalies as unknown[])?.length || 0;

        const escalation = shouldEscalateDepth(plan.depth, {
            anomaliesFound: anomalies,
            unexpectedResults: anomalies > 2
        });

        if (escalation.escalate && escalation.newDepth) {
            console.log(`[Controller] Escalating: ${escalation.reason}`);
            // Add causal reasoner if escalating to deep
            if (escalation.newDepth === 'deep' && !plan.agents.includes('causal_reasoner')) {
                plan.agents.push('causal_reasoner');
            }
        }

        // Group 3: Causal reasoning (if in plan)
        if (plan.agents.includes('causal_reasoner')) {
            await this.executeAgent('causal_reasoner', {
                tool: 'explain_metric_change',
                entity_id: input.entityId,
                metric: (input.context?.metric as string) || 'roas',
                period: '7d'
            });
        }

        // Group 4: Risk assessment
        if (plan.agents.includes('risk_guard')) {
            await this.executeAgent('risk_guard', {
                tool: 'validate_action_safety',
                action_type: input.queryType,
                entity_id: input.entityId,
                parameters: input.context || {}
            });
        }

        // Group 5: Generate explanation
        if (plan.agents.includes('explainer')) {
            await this.executeAgent('explainer', {
                tool: 'format_explanation',
                evidence: this.state.gatheredData,
                assumptions: [],
                confidence: this.calculateAggregateConfidence()
            });
        }

        // Group 6: Priority scoring
        if (plan.agents.includes('prioritizer')) {
            await this.executeAgent('prioritizer', {
                tool: 'calculate_impact',
                metric: (input.context?.metric as string) || 'roas',
                current_value: (input.context?.current_value as number) || 0,
                expected_value: (input.context?.expected_value as number) || 0
            });
        }
    }

    /**
     * Execute a single agent
     */
    private async executeAgent(
        agentType: AgentType,
        input: Record<string, unknown>
    ): Promise<ToolOutput> {
        if (!this.state) throw new Error('Controller state not initialized');

        const step: AgentExecutionStep = {
            id: uuidv4(),
            agentType,
            toolName: input.tool as string || 'unknown',
            toolInput: input,
            status: 'executing',
            startedAt: new Date()
        };

        this.state.run.steps.push(step);
        this.state.currentStep++;

        try {
            const executor = this.agentExecutors.get(agentType);

            let result: ToolOutput;
            if (executor) {
                result = await executor(input);
            } else {
                // Mock execution for agents without registered executors
                result = this.mockAgentExecution(agentType, input);
            }

            step.toolOutput = result;
            step.status = 'completed';
            step.completedAt = new Date();
            step.durationMs = step.completedAt.getTime() - step.startedAt!.getTime();

            // Store result
            this.state.gatheredData[agentType] = result;

            console.log(`[Controller] ${agentType} completed in ${step.durationMs}ms`);

            return result;
        } catch (error) {
            step.status = 'failed';
            step.error = String(error);
            step.completedAt = new Date();

            return {
                success: false,
                error: String(error)
            };
        }
    }

    /**
     * Mock agent execution for testing/development
     */
    private mockAgentExecution(agentType: AgentType, input: Record<string, unknown>): ToolOutput {
        const config = AGENT_CONFIGS[agentType];

        // Return mock results based on agent type
        switch (agentType) {
            case 'data_validator':
                return {
                    success: true,
                    data: { complete: true, missing_fields: [], completeness_pct: 95 },
                    confidence: 0.9
                };

            case 'performance_analyst':
                return {
                    success: true,
                    data: {
                        trend: 'stable',
                        slope: 0.02,
                        anomalies: []
                    },
                    confidence: 0.85
                };

            case 'causal_reasoner':
                return {
                    success: true,
                    data: {
                        causes: [
                            { factor: 'creative_quality', contribution: 0.4, confidence: 0.7 },
                            { factor: 'audience_saturation', contribution: 0.3, confidence: 0.6 }
                        ],
                        summary: 'Performance driven primarily by creative quality'
                    },
                    confidence: 0.65
                };

            case 'risk_guard':
                return {
                    success: true,
                    data: {
                        safe: true,
                        risks: [],
                        requires_approval: false
                    },
                    confidence: 0.95
                };

            case 'explainer':
                return {
                    success: true,
                    data: {
                        summary: 'Analysis complete with high confidence',
                        key_points: ['Data is fresh', 'Performance is stable', 'No significant risks']
                    },
                    confidence: 0.8
                };

            case 'prioritizer':
                return {
                    success: true,
                    data: {
                        impact_score: 0.6,
                        reasoning: 'Medium expected impact based on historical patterns'
                    },
                    confidence: 0.75
                };

            default:
                return { success: true, data: {}, confidence: 0.5 };
        }
    }

    /**
     * Calculate aggregate confidence from all agents
     */
    private calculateAggregateConfidence(): number {
        if (!this.state) return 0.5;

        const confidences: number[] = [];
        for (const [, result] of Object.entries(this.state.gatheredData)) {
            if ((result as ToolOutput)?.confidence) {
                confidences.push((result as ToolOutput).confidence!);
            }
        }

        if (confidences.length === 0) return 0.5;
        return confidences.reduce((a, b) => a + b, 0) / confidences.length;
    }

    /**
     * Synthesize results from all agents
     */
    private synthesizeResults(): Record<string, unknown> {
        if (!this.state) return {};

        const { gatheredData } = this.state;
        const confidence = this.calculateAggregateConfidence();

        // Extract key findings
        const findings: string[] = [];
        const warnings: string[] = (gatheredData['warnings'] as string[]) || [];
        const recommendations: Array<Record<string, unknown>> = [];

        // From performance analyst
        const perfResult = gatheredData['performance_analyst'] as ToolOutput | undefined;
        if (perfResult?.data) {
            const trend = perfResult.data.trend as string;
            if (trend) {
                findings.push(`Performance trend: ${trend}`);
            }
            const anomalies = perfResult.data.anomalies as unknown[];
            if (anomalies?.length > 0) {
                warnings.push(`${anomalies.length} anomalies detected`);
            }
        }

        // From causal reasoner
        const causalResult = gatheredData['causal_reasoner'] as ToolOutput | undefined;
        if (causalResult?.data?.summary) {
            findings.push(causalResult.data.summary as string);
        }

        // From risk guard
        const riskResult = gatheredData['risk_guard'] as ToolOutput | undefined;
        if (riskResult?.data) {
            const risks = riskResult.data.risks as string[];
            if (risks?.length > 0) {
                warnings.push(...risks);
            }
        }

        // From explainer
        const explainerResult = gatheredData['explainer'] as ToolOutput | undefined;
        const explanation = (explainerResult?.data?.summary as string) ||
            'Analysis completed with available data.';

        // From prioritizer
        const priorityResult = gatheredData['prioritizer'] as ToolOutput | undefined;
        const impactScore = (priorityResult?.data?.impact_score as number) || 0.5;

        return {
            findings,
            warnings,
            recommendations,
            explanation,
            confidence,
            impactScore,
            depth: this.state.decisions[0]?.depth || 'standard',
            agentCount: this.state.run.steps.length,
            raw: gatheredData
        };
    }
}

// Export singleton instance
export const controllerAgent = new ControllerAgent();
