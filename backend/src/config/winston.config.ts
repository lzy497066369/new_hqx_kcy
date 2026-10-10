import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import { join } from 'node:path';

/**
 * Winston日志配置
 * 提供统一的日志格式和输出配置
 */

const logDir = process.env.LOG_DIR || 'logs';

// 自定义日志格式
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

// 控制台输出格式（带颜色）
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, context, trace }) => {
    const contextStr = context ? `[${context}] ` : '';
    const traceStr = trace ? `\n${trace}` : '';
    return `${timestamp} ${level}: ${contextStr}${message}${traceStr}`;
  }),
);

/**
 * 创建Winston配置
 */
export function createWinstonConfig(): WinstonModuleOptions {
  const transports: winston.transport[] = [];

  // 开发环境：控制台输出
  if (process.env.NODE_ENV !== 'production') {
    transports.push(
      new winston.transports.Console({
        format: consoleFormat,
      }),
    );
  }

  // 生产环境：文件输出
  if (process.env.NODE_ENV === 'production') {
    // 错误日志
    transports.push(
      new winston.transports.File({
        filename: join(logDir, 'error.log'),
        level: 'error',
        format: customFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 10,
      }),
    );

    // 警告日志
    transports.push(
      new winston.transports.File({
        filename: join(logDir, 'warn.log'),
        level: 'warn',
        format: customFormat,
        maxsize: 10 * 1024 * 1024,
        maxFiles: 5,
      }),
    );

    // 综合日志
    transports.push(
      new winston.transports.File({
        filename: join(logDir, 'combined.log'),
        format: customFormat,
        maxsize: 20 * 1024 * 1024, // 20MB
        maxFiles: 10,
      }),
    );

    // 生产环境也输出到控制台（简化格式）
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.simple(),
        ),
      }),
    );
  }

  return {
    transports,
    // 默认日志级别
    level: process.env.LOG_LEVEL || 'info',
    // 退出时处理
    exitOnError: false,
  };
}

/**
 * 日志级别说明：
 * error: 错误信息，需要立即处理
 * warn: 警告信息，潜在问题
 * info: 一般信息，重要的业务流程
 * http: HTTP请求日志
 * verbose: 详细信息
 * debug: 调试信息
 * silly: 最详细的信息
 */
