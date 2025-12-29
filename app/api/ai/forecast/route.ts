/**
 * Forecasting API Route
 * 
 * GET - Get forecast for entity
 * POST - Generate new forecast or run what-if simulation
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    generateForecast,
    runWhatIfSimulation,
    type Forecast,
    type WhatIfScenario
} from '@/lib/ai/forecasting';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const entityId = searchParams.get('entityId');
        const entityType = searchParams.get('entityType') || 'campaign';
        const metric = searchParams.get('metric') || 'spend';
        const horizonDays = parseInt(searchParams.get('horizon') || '7');

        if (!entityId) {
            return NextResponse.json(
                { error: 'entityId is required' },
                { status: 400 }
            );
        }

        // In production, fetch historical data from database
        // For now, generate sample data
        const today = new Date();
        const historicalData = Array.from({ length: 30 }, (_, i) => {
            const date = new Date(today);
            date.setDate(date.getDate() - (30 - i));
            return {
                date: date.toISOString().split('T')[0],
                value: 1000 + Math.random() * 500 + i * 10 // Slight upward trend
            };
        });

        const forecast: Forecast = generateForecast({
            entityId,
            metric,
            historicalData,
            horizonDays,
            modelType: 'auto'
        });

        return NextResponse.json({
            success: true,
            data: forecast
        });

    } catch (error) {
        console.error('Forecast error:', error);
        return NextResponse.json(
            { error: 'Failed to generate forecast' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            type,
            entityId,
            currentMetrics,
            interventions,
            metric,
            horizonDays
        } = body;

        if (type === 'whatif') {
            // What-if simulation
            if (!currentMetrics || !interventions) {
                return NextResponse.json(
                    { error: 'currentMetrics and interventions are required for what-if' },
                    { status: 400 }
                );
            }

            const simulation: WhatIfScenario = runWhatIfSimulation({
                entityId: entityId || 'simulation',
                currentMetrics,
                interventions
            });

            return NextResponse.json({
                success: true,
                data: simulation
            });

        } else {
            // Generate forecast
            if (!entityId) {
                return NextResponse.json(
                    { error: 'entityId is required' },
                    { status: 400 }
                );
            }

            // Sample historical data - in production, fetch from DB
            const today = new Date();
            const historicalData = Array.from({ length: 30 }, (_, i) => {
                const date = new Date(today);
                date.setDate(date.getDate() - (30 - i));
                return {
                    date: date.toISOString().split('T')[0],
                    value: 1000 + Math.random() * 500 + i * 10
                };
            });

            const forecast: Forecast = generateForecast({
                entityId,
                metric: metric || 'spend',
                historicalData,
                horizonDays: horizonDays || 7,
                modelType: 'auto'
            });

            return NextResponse.json({
                success: true,
                data: forecast
            });
        }

    } catch (error) {
        console.error('Forecast/Simulation error:', error);
        return NextResponse.json(
            { error: 'Failed to process request' },
            { status: 500 }
        );
    }
}
