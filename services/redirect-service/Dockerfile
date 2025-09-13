FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

RUN npm install -g nodemon

COPY . .

CMD ["nodemon", "--legacy-watch", "--ext", "ts,js,json", "--watch", "src", "src/index.ts"]
