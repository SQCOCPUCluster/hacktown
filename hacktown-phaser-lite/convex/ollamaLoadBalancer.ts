import { logger } from "./logger";

/**
 * Multi-GPU Load Balancer for Ollama
 * Distributes inference requests across Mac GPU and Windows GPU
 */

export interface OllamaServer {
  url: string;
  name: string;
  weight: number; // 0.0 to 1.0 (percentage of requests)
  healthy: boolean;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalResponseTime: number;
  activeRequests: number;
}

export interface GenerateRequest {
  model: string;
  prompt: string;
  stream: boolean;
  options: {
    temperature: number;
    num_predict: number;
  };
  timeout?: number; // Optional timeout in milliseconds (default: 30000)
}

export interface GenerateResponse {
  response: string;
  server: string; // Which server handled the request
}

class OllamaLoadBalancer {
  private servers: OllamaServer[] = [];
  private lastHealthCheck = 0;
  private initialized = false;

  constructor(servers: Array<{ url: string; name: string; weight: number }>) {
    this.servers = servers.map(s => ({
      ...s,
      healthy: true, // Assume healthy initially
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      activeRequests: 0,
    }));

    // Don't log or run health checks in constructor
    // Will be done lazily on first use
  }

  /**
   * Initialize the load balancer (call on first use)
   */
  private ensureInitialized() {
    if (!this.initialized) {
      logger.info(`🔄 Load balancer initialized with ${this.servers.length} servers:`);
      this.servers.forEach(s => {
        logger.info(`   • ${s.name} (${s.url}) - weight: ${(s.weight * 100).toFixed(0)}%`);
      });
      this.initialized = true;
    }
  }

  /**
   * Check health of all servers
   */
  async checkHealth(): Promise<void> {
    logger.debug("🏥 Running health checks on all servers...");

    const healthPromises = this.servers.map(async (server) => {
      try {
        const startTime = Date.now();
        const response = await fetch(`${server.url}/api/tags`, {
          method: "GET",
          signal: AbortSignal.timeout(5000), // 5s timeout
        });

        const elapsed = Date.now() - startTime;
        const wasHealthy = server.healthy;
        server.healthy = response.ok;

        if (server.healthy && !wasHealthy) {
          logger.info(`✅ ${server.name} is now healthy (${elapsed}ms)`);
        } else if (!server.healthy && wasHealthy) {
          logger.warn(`❌ ${server.name} is now unhealthy`);
        }
      } catch (error) {
        const wasHealthy = server.healthy;
        server.healthy = false;
        if (wasHealthy) {
          logger.warn(`❌ ${server.name} health check failed:`, error);
        }
      }
    });

    await Promise.all(healthPromises);
    this.lastHealthCheck = Date.now();
  }

  /**
   * Get next server using weighted round-robin
   */
  private getNextServer(): OllamaServer | null {
    const healthyServers = this.servers.filter(s => s.healthy);

    if (healthyServers.length === 0) {
      logger.error("❌ No healthy servers available");
      return null;
    }

    // Weighted round-robin selection
    // Convert weights to cumulative probabilities
    const random = Math.random();
    let cumulative = 0;

    for (const server of healthyServers) {
      cumulative += server.weight;
      if (random <= cumulative) {
        return server;
      }
    }

    // Fallback to first healthy server
    return healthyServers[0];
  }

  /**
   * Generate text using load-balanced Ollama servers
   */
  async generate(request: GenerateRequest): Promise<GenerateResponse | null> {
    // Lazy initialization on first use
    this.ensureInitialized();

    // Run health check if it's been more than 30 seconds
    if (Date.now() - this.lastHealthCheck > 30000) {
      // Don't await - let it run in background
      this.checkHealth().catch(err =>
        logger.debug("Health check error:", err)
      );
    }

    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const server = this.getNextServer();

      if (!server) {
        logger.error("❌ No servers available for inference");
        return null;
      }

      try {
        logger.debug(`🎯 Routing request to ${server.name} (attempt ${attempt + 1}/${maxRetries})`);

        server.totalRequests++;
        server.activeRequests++;
        const startTime = Date.now();

        // Use custom timeout or default to 30s (dialogues need more time)
        const timeoutMs = request.timeout || 30000;

        const response = await fetch(`${server.url}/api/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: request.model,
            prompt: request.prompt,
            stream: request.stream,
            options: request.options,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });

        const elapsed = Date.now() - startTime;
        server.activeRequests--;

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Success!
        server.successfulRequests++;
        server.totalResponseTime += elapsed;

        const avgTime = (server.totalResponseTime / server.successfulRequests).toFixed(0);
        logger.debug(`✅ ${server.name} completed in ${elapsed}ms (avg: ${avgTime}ms)`);

        return {
          response: data.response,
          server: server.name,
        };

      } catch (error) {
        server.failedRequests++;
        server.activeRequests--;
        lastError = error as Error;

        const errorName = error instanceof Error ? error.name : 'Unknown';
        const errorMsg = error instanceof Error ? error.message : String(error);

        logger.warn(`⚠️ ${server.name} request failed: ${errorName} - ${errorMsg}`);

        // Mark server as unhealthy if it fails
        server.healthy = false;

        // Try next server on failure
        continue;
      }
    }

    // All retries failed
    logger.error(`❌ All inference attempts failed. Last error:`, lastError);
    return null;
  }

  /**
   * Get load balancer statistics
   */
  getStats() {
    const stats = this.servers.map(s => ({
      name: s.name,
      url: s.url,
      healthy: s.healthy,
      weight: s.weight,
      totalRequests: s.totalRequests,
      successfulRequests: s.successfulRequests,
      failedRequests: s.failedRequests,
      successRate: s.totalRequests > 0
        ? ((s.successfulRequests / s.totalRequests) * 100).toFixed(1)
        : "N/A",
      avgResponseTime: s.successfulRequests > 0
        ? (s.totalResponseTime / s.successfulRequests).toFixed(0)
        : "N/A",
      activeRequests: s.activeRequests,
    }));

    return stats;
  }

  /**
   * Log current statistics
   */
  logStats() {
    logger.info("📊 Load Balancer Statistics:");
    const stats = this.getStats();
    stats.forEach(s => {
      logger.info(`   ${s.name}: ${s.successfulRequests}/${s.totalRequests} requests (${s.successRate}% success) - avg ${s.avgResponseTime}ms - ${s.healthy ? '✅' : '❌'}`);
    });
  }
}

// Singleton instance to avoid multiple initializations
let loadBalancerInstance: OllamaLoadBalancer | null = null;

/**
 * Get the shared load balancer instance
 */
export function getLoadBalancer(): OllamaLoadBalancer {
  if (!loadBalancerInstance) {
    loadBalancerInstance = new OllamaLoadBalancer([
      // {
      //   url: "http://localhost:11434",
      //   name: "Mac GPU",
      //   weight: 0.3, // 30% of requests - PAUSED
      // },
      {
        url: "http://sqcgpucluster.tailf842ea.ts.net:11434",
        name: "Windows GPU",
        weight: 1.0, // 100% of requests (Mac GPU paused)
      },
    ]);
  }
  return loadBalancerInstance;
}

// Backwards compatibility: export the getter function as the default
export const ollamaLoadBalancer = {
  generate: async (request: GenerateRequest) => getLoadBalancer().generate(request),
  checkHealth: async () => getLoadBalancer().checkHealth(),
  getStats: () => getLoadBalancer().getStats(),
  logStats: () => getLoadBalancer().logStats(),
};
