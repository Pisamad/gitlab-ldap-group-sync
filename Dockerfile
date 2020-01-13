FROM alpine

RUN apk add nodejs npm python make

ENV NODE_ENV production

WORKDIR /app
COPY ./src /app
COPY ./package.json /app/

RUN npm install

CMD ["node", "./bin/www"]

EXPOSE 80
