#!/bin/bash
# 数据库备份脚本
# 用法: ./scripts/backup-db.sh [backup_dir]

set -e

BACKUP_DIR="${1:-/backup/gongkao}"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="gongkao"
BACKUP_FILE="${BACKUP_DIR}/gongkao_backup_${DATE}.sql.gz"

echo "=== Gongkao 数据库备份 ==="
echo "备份目录: $BACKUP_DIR"
echo "备份文件: $BACKUP_FILE"
echo ""

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 检查 Docker 容器是否运行
if ! docker-compose -f docker-compose.saas.yml ps postgres | grep -q "Up"; then
    echo "错误: PostgreSQL 容器未运行"
    echo "请先启动: docker-compose -f docker-compose.saas.yml up -d postgres"
    exit 1
fi

# 执行备份
echo "正在备份数据库..."
docker-compose -f docker-compose.saas.yml exec -T postgres pg_dump -U postgres "$DB_NAME" | gzip > "$BACKUP_FILE"

# 检查备份文件
if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ 备份成功: $BACKUP_FILE (大小: $SIZE)"
else
    echo "❌ 备份失败"
    exit 1
fi

# 清理 7 天前的备份
echo "清理旧备份..."
find "$BACKUP_DIR" -name "gongkao_backup_*.sql.gz" -mtime +7 -delete
echo "✅ 清理完成"

# 输出备份摘要
echo ""
echo "备份摘要:"
ls -lh "$BACKUP_DIR" | tail -5
