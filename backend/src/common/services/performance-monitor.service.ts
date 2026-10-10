import { Injectable, Logger } from '@nestjs/common';

/**
 * 性能监控服务
 * 用于监控和记录应用性能指标
 */
@Injectable()
export class PerformanceMonitorService {
  private readonly logger = new Logger(PerformanceMonitorService.name);
  private readonly metrics: Map<string, PerformanceMetric> = new Map();

  /**
   * 记录操作执行时间
   */
  async measureExecutionTime<T>(
    operationName: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - start;
      this.recordMetric(operationName, duration, 'success');
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.recordMetric(operationName, duration, 'error');
      throw error;
    }
  }

  /**
   * 记录性能指标
   */
  private recordMetric(
    operationName: string,
    duration: number,
    status: 'success' | 'error',
  ) {
    const metric = this.metrics.get(operationName) || {
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      errorCount: 0,
    };

    metric.count++;
    metric.totalDuration += duration;
    metric.avgDuration = metric.totalDuration / metric.count;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);

    if (status === 'error') {
      metric.errorCount++;
    }

    this.metrics.set(operationName, metric);

    // 慢操作警告
    if (duration > 3000) {
      this.logger.warn(
        `Slow operation detected: ${operationName} took ${duration}ms`,
      );
    }
  }

  /**
   * 获取所有性能指标
   */
  getMetrics(): Record<string, PerformanceMetric> {
    const result: Record<string, PerformanceMetric> = {};
    this.metrics.forEach((value, key) => {
      result[key] = { ...value };
    });
    return result;
  }

  /**
   * 重置指标
   */
  resetMetrics() {
    this.metrics.clear();
  }

  /**
   * 获取Top N最慢的操作
   */
  getTopSlowOperations(n: number = 10): Array<{ name: string; avgDuration: number }> {
    const operations = Array.from(this.metrics.entries())
      .map(([name, metric]) => ({
        name,
        avgDuration: metric.avgDuration,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, n);

    return operations;
  }
}

interface PerformanceMetric {
  count: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  errorCount: number;
}

/**
 * 性能监控装饰器
 */
export function Monitor(operationName?: string) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const name = operationName || `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - start;

        if (duration > 1000) {
          console.warn(`[PERFORMANCE] ${name} took ${duration}ms`);
        }

        return result;
      } catch (error) {
        const duration = Date.now() - start;
        console.error(`[PERFORMANCE] ${name} failed after ${duration}ms`);
        throw error;
      }
    };

    return descriptor;
  };
}
