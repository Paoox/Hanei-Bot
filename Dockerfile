FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./
COPY . .

RUN npm install

EXPOSE 3000

RUN tar -xzvf auth.tar.gz

CMD ["node", "index.js"]

