# 使用官方LTS版本的Node.js镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 先复制package.json文件并安装依赖
COPY package.json package-lock.json ./
RUN npm install --production

# 复制项目文件
COPY . .

# 暴露端口(与app.js中的端口一致)
EXPOSE 3000

# 使用package.json中定义的start脚本启动应用
CMD ["npm", "start"]
