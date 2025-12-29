/**
 * Prompt Versioning and Model Tracking Module
 * 
 * Track prompt versions, model performance, and detect regressions.
 */

export interface PromptVersion {
    id: string;
    name: string;
    template: string;
    variables: string[];
    version: number;
    status: 'draft' | 'active' | 'deprecated' | 'archived';
    createdBy: string;
    createdAt: string;
    activatedAt?: string;
    deprecatedAt?: string;
    notes?: string;

    // Performance tracking
    usageCount: number;
    successRate: number;
    avgLatencyMs: number;
    avgTokens: number;
}

export interface ModelConfig {
    id: string;
    name: string;
    provider: 'nvidia' | 'openai' | 'anthropic' | 'custom';
    model: string;
    version: string;
    parameters: {
        temperature?: number;
        maxTokens?: number;
        topP?: number;
        frequencyPenalty?: number;
        presencePenalty?: number;
    };
    status: 'active' | 'testing' | 'deprecated';
    createdAt: string;
}

export interface PromptExecution {
    id: string;
    promptVersionId: string;
    modelConfigId: string;

    // Input
    variables: Record<string, unknown>;
    renderedPrompt: string;

    // Output
    response: string;
    tokensUsed: number;
    latencyMs: number;

    // Evaluation
    success: boolean;
    qualityScore?: number;
    userFeedback?: 'positive' | 'negative' | 'neutral';
    errorType?: string;

    createdAt: string;
}

export interface RegressionAlert {
    id: string;
    promptVersionId: string;
    modelConfigId?: string;

    alertType: 'success_rate_drop' | 'latency_increase' | 'quality_drop' | 'error_spike';
    severity: 'low' | 'medium' | 'high' | 'critical';

    baselineValue: number;
    currentValue: number;
    changePercent: number;

    windowStart: string;
    windowEnd: string;
    sampleSize: number;

    status: 'active' | 'acknowledged' | 'resolved' | 'false_positive';
    acknowledgedBy?: string;

    createdAt: string;
}

/**
 * Generate a new version ID
 */
function generateVersionId(): string {
    return `pv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new prompt version
 */
export function createPromptVersion(params: {
    name: string;
    template: string;
    createdBy: string;
    notes?: string;
    existingVersions?: PromptVersion[];
}): PromptVersion {
    const { name, template, createdBy, notes, existingVersions = [] } = params;

    // Extract variables from template ({{variable}})
    const variableMatches = template.match(/\{\{(\w+)\}\}/g) || [];
    const variables = [...new Set(variableMatches.map(v => v.replace(/\{\{|\}\}/g, '')))];

    // Determine version number
    const existingWithSameName = existingVersions.filter(v => v.name === name);
    const maxVersion = Math.max(0, ...existingWithSameName.map(v => v.version));

    return {
        id: generateVersionId(),
        name,
        template,
        variables,
        version: maxVersion + 1,
        status: 'draft',
        createdBy,
        createdAt: new Date().toISOString(),
        notes,
        usageCount: 0,
        successRate: 0,
        avgLatencyMs: 0,
        avgTokens: 0
    };
}

/**
 * Render a prompt with variables
 */
export function renderPrompt(
    template: string,
    variables: Record<string, unknown>
): string {
    let rendered = template;

    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        rendered = rendered.replace(regex, String(value));
    }

    return rendered;
}

/**
 * Calculate performance metrics from executions
 */
export function calculatePromptMetrics(executions: PromptExecution[]): {
    successRate: number;
    avgLatencyMs: number;
    avgTokens: number;
    avgQualityScore: number;
    errorRate: number;
    errorBreakdown: Record<string, number>;
} {
    if (executions.length === 0) {
        return {
            successRate: 0,
            avgLatencyMs: 0,
            avgTokens: 0,
            avgQualityScore: 0,
            errorRate: 0,
            errorBreakdown: {}
        };
    }

    const successful = executions.filter(e => e.success);
    const withQuality = executions.filter(e => e.qualityScore !== undefined);
    const errors = executions.filter(e => !e.success);

    const errorBreakdown: Record<string, number> = {};
    for (const error of errors) {
        const type = error.errorType || 'unknown';
        errorBreakdown[type] = (errorBreakdown[type] || 0) + 1;
    }

    return {
        successRate: successful.length / executions.length,
        avgLatencyMs: executions.reduce((sum, e) => sum + e.latencyMs, 0) / executions.length,
        avgTokens: executions.reduce((sum, e) => sum + e.tokensUsed, 0) / executions.length,
        avgQualityScore: withQuality.length > 0
            ? withQuality.reduce((sum, e) => sum + (e.qualityScore || 0), 0) / withQuality.length
            : 0,
        errorRate: errors.length / executions.length,
        errorBreakdown
    };
}

/**
 * Detect regression compared to baseline
 */
export function detectRegression(params: {
    promptVersionId: string;
    modelConfigId?: string;
    baselineExecutions: PromptExecution[];
    currentExecutions: PromptExecution[];
    thresholds?: {
        successRateDropPct: number;
        latencyIncreasePct: number;
        qualityDropPct: number;
        errorSpikePct: number;
    };
}): RegressionAlert[] {
    const {
        promptVersionId,
        modelConfigId,
        baselineExecutions,
        currentExecutions,
        thresholds = {
            successRateDropPct: 10,
            latencyIncreasePct: 30,
            qualityDropPct: 15,
            errorSpikePct: 50
        }
    } = params;

    const alerts: RegressionAlert[] = [];

    if (baselineExecutions.length < 10 || currentExecutions.length < 10) {
        return alerts; // Not enough data
    }

    const baseline = calculatePromptMetrics(baselineExecutions);
    const current = calculatePromptMetrics(currentExecutions);

    const now = new Date().toISOString();
    const windowStart = currentExecutions.length > 0
        ? currentExecutions[0].createdAt
        : now;
    const windowEnd = currentExecutions.length > 0
        ? currentExecutions[currentExecutions.length - 1].createdAt
        : now;

    // Check success rate drop
    if (baseline.successRate > 0) {
        const dropPct = ((baseline.successRate - current.successRate) / baseline.successRate) * 100;
        if (dropPct >= thresholds.successRateDropPct) {
            alerts.push({
                id: `ra_${Date.now()}_1`,
                promptVersionId,
                modelConfigId,
                alertType: 'success_rate_drop',
                severity: dropPct > 30 ? 'critical' : dropPct > 20 ? 'high' : 'medium',
                baselineValue: baseline.successRate * 100,
                currentValue: current.successRate * 100,
                changePercent: -dropPct,
                windowStart,
                windowEnd,
                sampleSize: currentExecutions.length,
                status: 'active',
                createdAt: now
            });
        }
    }

    // Check latency increase
    if (baseline.avgLatencyMs > 0) {
        const increasePct = ((current.avgLatencyMs - baseline.avgLatencyMs) / baseline.avgLatencyMs) * 100;
        if (increasePct >= thresholds.latencyIncreasePct) {
            alerts.push({
                id: `ra_${Date.now()}_2`,
                promptVersionId,
                modelConfigId,
                alertType: 'latency_increase',
                severity: increasePct > 100 ? 'high' : 'medium',
                baselineValue: baseline.avgLatencyMs,
                currentValue: current.avgLatencyMs,
                changePercent: increasePct,
                windowStart,
                windowEnd,
                sampleSize: currentExecutions.length,
                status: 'active',
                createdAt: now
            });
        }
    }

    // Check quality drop
    if (baseline.avgQualityScore > 0 && current.avgQualityScore > 0) {
        const dropPct = ((baseline.avgQualityScore - current.avgQualityScore) / baseline.avgQualityScore) * 100;
        if (dropPct >= thresholds.qualityDropPct) {
            alerts.push({
                id: `ra_${Date.now()}_3`,
                promptVersionId,
                modelConfigId,
                alertType: 'quality_drop',
                severity: dropPct > 25 ? 'high' : 'medium',
                baselineValue: baseline.avgQualityScore,
                currentValue: current.avgQualityScore,
                changePercent: -dropPct,
                windowStart,
                windowEnd,
                sampleSize: currentExecutions.length,
                status: 'active',
                createdAt: now
            });
        }
    }

    // Check error spike
    if (current.errorRate > baseline.errorRate) {
        const spikePct = baseline.errorRate > 0
            ? ((current.errorRate - baseline.errorRate) / baseline.errorRate) * 100
            : current.errorRate * 100;

        if (spikePct >= thresholds.errorSpikePct) {
            alerts.push({
                id: `ra_${Date.now()}_4`,
                promptVersionId,
                modelConfigId,
                alertType: 'error_spike',
                severity: current.errorRate > 0.2 ? 'critical' : current.errorRate > 0.1 ? 'high' : 'medium',
                baselineValue: baseline.errorRate * 100,
                currentValue: current.errorRate * 100,
                changePercent: spikePct,
                windowStart,
                windowEnd,
                sampleSize: currentExecutions.length,
                status: 'active',
                createdAt: now
            });
        }
    }

    return alerts;
}

/**
 * Compare two prompt versions
 */
export function comparePromptVersions(
    versionA: PromptVersion,
    versionB: PromptVersion
): {
    better: 'a' | 'b' | 'tie';
    metrics: {
        metric: string;
        valueA: number;
        valueB: number;
        winner: 'a' | 'b' | 'tie';
    }[];
} {
    const metrics: Array<{
        metric: string;
        valueA: number;
        valueB: number;
        winner: 'a' | 'b' | 'tie';
    }> = [];

    // Success rate (higher is better)
    metrics.push({
        metric: 'Success Rate',
        valueA: versionA.successRate,
        valueB: versionB.successRate,
        winner: versionA.successRate > versionB.successRate ? 'a' :
            versionB.successRate > versionA.successRate ? 'b' : 'tie'
    });

    // Latency (lower is better)
    metrics.push({
        metric: 'Latency',
        valueA: versionA.avgLatencyMs,
        valueB: versionB.avgLatencyMs,
        winner: versionA.avgLatencyMs < versionB.avgLatencyMs ? 'a' :
            versionB.avgLatencyMs < versionA.avgLatencyMs ? 'b' : 'tie'
    });

    // Token usage (lower is better for cost)
    metrics.push({
        metric: 'Token Usage',
        valueA: versionA.avgTokens,
        valueB: versionB.avgTokens,
        winner: versionA.avgTokens < versionB.avgTokens ? 'a' :
            versionB.avgTokens < versionA.avgTokens ? 'b' : 'tie'
    });

    // Count wins
    const winsA = metrics.filter(m => m.winner === 'a').length;
    const winsB = metrics.filter(m => m.winner === 'b').length;

    return {
        better: winsA > winsB ? 'a' : winsB > winsA ? 'b' : 'tie',
        metrics
    };
}

/**
 * Generate a diff between two prompt templates
 */
export function diffPromptTemplates(
    templateA: string,
    templateB: string
): { type: 'added' | 'removed' | 'unchanged'; line: string }[] {
    const linesA = templateA.split('\n');
    const linesB = templateB.split('\n');
    const diff: { type: 'added' | 'removed' | 'unchanged'; line: string }[] = [];

    const maxLen = Math.max(linesA.length, linesB.length);

    for (let i = 0; i < maxLen; i++) {
        const lineA = linesA[i];
        const lineB = linesB[i];

        if (lineA === lineB) {
            if (lineA !== undefined) {
                diff.push({ type: 'unchanged', line: lineA });
            }
        } else {
            if (lineA !== undefined) {
                diff.push({ type: 'removed', line: lineA });
            }
            if (lineB !== undefined) {
                diff.push({ type: 'added', line: lineB });
            }
        }
    }

    return diff;
}
