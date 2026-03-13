#!/usr/bin/env python3
"""
本地 embedding 生成器（使用 sentence-transformers）
用于离线向量化，避免依赖 OpenAI API
"""

from sentence_transformers import SentenceTransformer
import json
import sys

# 使用多语言模型，支持中文
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

def generate_embedding(text):
    """生成单个文本的 embedding"""
    embedding = model.encode(text)
    return embedding.tolist()

def generate_batch(texts):
    """批量生成"""
    embeddings = model.encode(texts)
    return embeddings.tolist()

if __name__ == "__main__":
    # 从 stdin 读取文本（一行一个）
    texts = []
    for line in sys.stdin:
        text = line.strip()
        if text:
            texts.append(text)
    
    if not texts:
        print(json.dumps({"error": "No input"}))
        sys.exit(1)
    
    # 生成 embeddings
    embeddings = generate_batch(texts)
    
    # 输出 JSON 数组
    print(json.dumps(embeddings, ensure_ascii=False))
