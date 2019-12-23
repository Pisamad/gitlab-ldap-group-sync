FROM alpine

RUN apk add nodejs npm python make

ENV NODE_ENV production

WORKDIR /app
COPY ./bin /app/bin
COPY ./routes /app/routes
COPY ./config /app/config
COPY ./*.js /app/
COPY ./*.json /app/

RUN npm install

CMD ["node", "./bin/www"]

EXPOSE 80
