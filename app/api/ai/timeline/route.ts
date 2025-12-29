/**
 * Timeline API Route
 * 
 * GET - Get timeline events with filtering
 * POST - Log new timeline event
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    filterTimelineEvents,
    groupEventsByDate,
    generateTimelineSummary,
    auditLogToTimelineEvent,
    type TimelineEvent,
    type TimelineFilter
} from '@/lib/ai/timeline';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;

        // Build filter from query params
        const filter: TimelineFilter = {};

        const types = searchParams.get('types');
        if (types) filter.types = types.split(',') as TimelineFilter['types'];

        const categories = searchParams.get('categories');
        if (categories) filter.categories = categories.split(',') as TimelineFilter['categories'];

        const entityTypes = searchParams.get('entityTypes');
        if (entityTypes) filter.entityTypes = entityTypes.split(',');

        const entityIds = searchParams.get('entityIds');
        if (entityIds) filter.entityIds = entityIds.split(',');

        const severity = searchParams.get('severity');
        if (severity) filter.severity = severity.split(',') as TimelineFilter['severity'];

        const dateFrom = searchParams.get('dateFrom');
        if (dateFrom) filter.dateFrom = dateFrom;

        const dateTo = searchParams.get('dateTo');
        if (dateTo) filter.dateTo = dateTo;

        const search = searchParams.get('search');
        if (search) filter.search = search;

        const groupBy = searchParams.get('groupBy') || 'date';
        const includeSummary = searchParams.get('summary') === 'true';

        // In production, fetch from database
        // For now, generate sample events
        const now = new Date();
        const sampleEvents: TimelineEvent[] = [
            {
                id: 'evt_1',
                type: 'recommendation_created',
                category: 'recommendation',
                timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
                entityType: 'campaign',
                entityId: 'camp_123',
                entityName: 'Summer Sale Campaign',
                actorType: 'ai',
                title: 'Budget Increase Recommended',
                description: 'AI suggests increasing budget by 20% based on strong ROAS',
                severity: 'info',
                icon: '💡'
            },
            {
                id: 'evt_2',
                type: 'recommendation_accepted',
                category: 'recommendation',
                timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
                entityType: 'campaign',
                entityId: 'camp_123',
                entityName: 'Summer Sale Campaign',
                actorType: 'user',
                actorName: 'John',
                title: 'Recommendation Accepted',
                description: 'Budget increase approved',
                severity: 'success',
                icon: '✅',
                parentEventId: 'evt_1'
            },
            {
                id: 'evt_3',
                type: 'anomaly_detected',
                category: 'alert',
                timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
                entityType: 'ad',
                entityId: 'ad_456',
                entityName: 'Video Ad - Blue',
                actorType: 'system',
                title: 'CTR Spike Detected',
                description: 'CTR increased 45% compared to 7-day average',
                severity: 'warning',
                icon: '📊'
            },
            {
                id: 'evt_4',
                type: 'agent_run_completed',
                category: 'agent',
                timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
                actorType: 'ai',
                title: 'Daily Analysis Complete',
                description: 'Analyzed 15 campaigns, generated 3 recommendations',
                duration: 12500,
                severity: 'success',
                icon: '🤖'
            }
        ];

        // Apply filters
        const filtered = filterTimelineEvents(sampleEvents, filter);

        // Group by date if requested
        const result = groupBy === 'date'
            ? groupEventsByDate(filtered)
            : filtered;

        // Add summary if requested
        const response: Record<string, unknown> = {
            success: true,
            data: result,
            total: filtered.length
        };

        if (includeSummary) {
            response.summary = generateTimelineSummary(filtered);
        }

        return NextResponse.json(response);

    } catch (error) {
        console.error('Timeline GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch timeline' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            eventType,
            category,
            title,
            description,
            entityType,
            entityId,
            entityName,
            actorType,
            actorId,
            actorName,
            details,
            severity
        } = body;

        if (!eventType || !category || !title) {
            return NextResponse.json(
                { error: 'eventType, category, and title are required' },
                { status: 400 }
            );
        }

        // In production, insert into database
        const event: TimelineEvent = {
            id: `evt_${Date.now()}`,
            type: eventType,
            category,
            timestamp: new Date().toISOString(),
            entityType,
            entityId,
            entityName,
            actorType: actorType || 'system',
            actorId,
            actorName,
            title,
            description: description || '',
            details,
            severity: severity || 'info'
        };

        return NextResponse.json({
            success: true,
            data: event
        });

    } catch (error) {
        console.error('Timeline POST error:', error);
        return NextResponse.json(
            { error: 'Failed to log event' },
            { status: 500 }
        );
    }
}
