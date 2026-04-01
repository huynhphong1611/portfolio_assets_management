# Sử dụng image Node.js nhẹ nhất
FROM node:20-alpine

# Tạo thư mục làm việc trong container
WORKDIR /app

# Copy file quản lý thư viện vào trước để tận dụng cache của Docker
COPY package.json package-lock.json* ./
RUN npm install

# Copy toàn bộ source code
COPY . .

# Expose port
EXPOSE 5173

# Lệnh khởi chạy dev server
CMD ["npm", "run", "dev"]