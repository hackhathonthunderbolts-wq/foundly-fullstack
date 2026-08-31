FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY src ./src
RUN javac -d out src/main/java/com/foundly/reference/ReferenceServiceApp.java

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/out ./out

EXPOSE 8002
CMD ["java", "-cp", "out", "com.foundly.reference.ReferenceServiceApp"]
