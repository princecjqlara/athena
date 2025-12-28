/**
 * Zod Validation Schemas
 * Centralized validation for API inputs and data structures
 */

import { z } from 'zod';

// =====================================================
// Auth Schemas
// =====================================================

export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signupSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['client', 'marketer', 'admin', 'organizer']).optional(),
    teamCode: z.string().optional(),
    inviteCode: z.string().optional(),
});

// =====================================================
// Sync Schemas
// =====================================================

export const syncDataSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    ads: z.array(z.object({
        id: z.string(),
    }).passthrough()).optional(),
    pipelines: z.array(z.object({
        id: z.string(),
        name: z.string().optional(),
        stages: z.array(z.any()).optional(),
    }).passthrough()).optional(),
    leads: z.array(z.object({
        pipelineId: z.string(),
        leads: z.array(z.any()),
    })).optional(),
    contacts: z.array(z.object({
        id: z.string(),
    }).passthrough()).optional(),
    settings: z.record(z.string(), z.any()).optional(),
});

// =====================================================
// AI Schemas
// =====================================================

export const aiRequestSchema = z.object({
    action: z.enum([
        'parse-content',
        'parse-results',
        'analyze-mindmap',
        'suggest-trait',
        'predict-success',
        'audience-segments',
        'suggest-next-steps'
    ]),
    rawText: z.string().optional(),
    ads: z.array(z.any()).optional(),
    customPrompt: z.string().optional(),
    learnedTraits: z.array(z.object({
        trait_name: z.string(),
        definition: z.string(),
    })).optional(),
});

export const learnedTraitSchema = z.object({
    traitName: z.string().min(1, 'Trait name is required'),
    traitCategory: z.string().optional(),
    definition: z.string().min(1, 'Definition is required'),
    businessType: z.string().optional(),
    addedBy: z.string().optional(),
});

// =====================================================
// Contacts Schemas
// =====================================================

export const contactSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, 'Name is required'),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    source: z.string().optional(),
    adId: z.string().optional(),
    stageId: z.string().optional(),
    messages: z.array(z.object({
        content: z.string(),
        timestamp: z.string(),
        sender: z.enum(['lead', 'business']).optional(),
    })).optional(),
});

// =====================================================
// Pipeline Schemas
// =====================================================

export const pipelineStageSchema = z.object({
    id: z.string(),
    name: z.string().min(1, 'Stage name is required'),
    color: z.string().optional(),
    order: z.number().optional(),
});

export const pipelineSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, 'Pipeline name is required'),
    stages: z.array(pipelineStageSchema).optional(),
});

// =====================================================
// Validation Helper Functions
// =====================================================

export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): {
    success: boolean;
    data?: T;
    errors?: string[]
} {
    try {
        const validated = schema.parse(data);
        return { success: true, data: validated };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors = error.issues.map(e => `${e.path.join('.')}: ${e.message}`);
            return { success: false, errors };
        }
        return { success: false, errors: ['Validation failed'] };
    }
}

export function validatePartial<T>(schema: z.ZodSchema<T>, data: unknown): {
    success: boolean;
    data?: Partial<T>;
    errors?: string[]
} {
    try {
        // Create partial schema for update operations
        const partialSchema = schema instanceof z.ZodObject ? schema.partial() : schema;
        const validated = partialSchema.parse(data);
        return { success: true, data: validated as Partial<T> };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors = error.issues.map(e => `${e.path.join('.')}: ${e.message}`);
            return { success: false, errors };
        }
        return { success: false, errors: ['Validation failed'] };
    }
}

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type SyncDataInput = z.infer<typeof syncDataSchema>;
export type AIRequestInput = z.infer<typeof aiRequestSchema>;
export type LearnedTraitInput = z.infer<typeof learnedTraitSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type PipelineInput = z.infer<typeof pipelineSchema>;
