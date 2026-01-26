#!/usr/bin/env bun

/**
 * Health check script for Docker container
 * Checks if the application is responding to HTTP requests
 */

const HEALTH_CHECK_URL = process.env.HEALTH_CHECK_URL || 'http://localhost:3000/';
const TIMEOUT_MS = parseInt(process.env.HEALTH_CHECK_TIMEOUT || '3000', 10);

async function healthCheck() {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

		const response = await fetch(HEALTH_CHECK_URL, {
			method: 'HEAD',
			signal: controller.signal,
			headers: {
				'User-Agent': 'Docker-HealthCheck/1.0'
			}
		});

		clearTimeout(timeoutId);

		if (response.ok) {
			console.log(`✓ Health check passed: ${response.status} ${response.statusText}`);
			process.exit(0);
		} else {
			console.error(`✗ Health check failed: ${response.status} ${response.statusText}`);
			process.exit(1);
		}
	} catch (error: any) {
		if (error.name === 'AbortError') {
			console.error(`✗ Health check timeout after ${TIMEOUT_MS}ms`);
		} else {
			console.error(`✗ Health check error: ${error.message}`);
		}
		process.exit(1);
	}
}

healthCheck();
