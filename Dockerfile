# Sử dụng image Node.js nhẹ nhất
FROM node:20-alpine

# Tạo thư mục làm việc trong container
WORKDIR /app

# Copy file quản lý thư viện vào trước để tận dụng cache của Docker
COPY package.json package-lock.json* ./
RUN npm install

# Lệnh khởi chạy dev server, expose ra mạng bên ngoài của container
CMD ["npm", "run", "dev", "--", "--host"]