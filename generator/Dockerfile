### Build
FROM golang:1.14 AS build

RUN groupadd dockeruser && useradd --no-log-init --gid dockeruser --create-home dockeruser
USER dockeruser:dockeruser

# RUN mkdir /home/dockeruser/src
#WORKDIR /home/dockeruser

RUN git clone https://github.com/Balise42/marzipango.git /home/dockeruser/src
WORKDIR /home/dockeruser/src
#COPY *.go ./
#COPY --chown=dockeruser:dockeruser go.* ./
#RUN ls -al /home

RUN go get -d -v ./...
RUN CGO_ENABLED=0 GOOS=linux go build marzipan.go


### Run
FROM alpine:latest AS run
RUN addgroup -S dockeruser && adduser -S dockeruser -G dockeruser
USER dockeruser:dockeruser
WORKDIR /home/dockeruser
COPY --from=build /home/dockeruser/src/marzipan .

ENTRYPOINT ["./marzipan"]
CMD ["--port=8080", "--hostname=0.0.0.0"]