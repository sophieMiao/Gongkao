# Dockerfile
FROM node:18-alpine AS builder

# 安装 Python（用于 AI 生成器）
RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
COPY requirements.txt ./

# 安装依赖
RUN npm ci --only=production
RUN pip3 install --no-cache-dir -r requirements.txt

# 复制源代码
COPY . .

# 生产环境构建（如果需要）
# RUN npm run build

# 运行时镜像
FROM node:18-alpine

# 安装 Python
RUN apk add --no-cache python3

WORKDIR /app

# 从 builder 复制 node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist 2>/dev/null || true

# 复制源代码
COPY --from=builder /app/skills ./skills
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/data ./data
COPY --from=builder /app/config ./config
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/*.js ./

# 安装 Python 依赖
COPY --from=builder /usr/local/lib/python3.*/site-packages /usr/local/lib/python3.*/site-packages
COPY --from=builder /usr/local/bin/pip3 /usr/local/bin/pip3

# 创建数据目录
RUN mkdir -p data/generated

# 环境变量
ENV NODE_ENV=production
ENV PORT=8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {if(r.statusCode!==200)throw new Error(r.statusCode)})"

# 暴露端口
EXPOSE 8080

# 启动命令
CMD ["node", "server.js"]
