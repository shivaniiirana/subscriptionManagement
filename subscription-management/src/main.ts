import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import { json, urlencoded } from 'express';
import * as cors from 'cors';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/httpExceptionFilter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
   app.useGlobalFilters(new HttpExceptionFilter());

  app.use(
    '/webhook/stripe',
    express.raw({ type: 'application/json' }),
    (req: any, res, next) => {
      req.rawBody = req.body;
      next();
    },
  );

  app.use(cors()); 

 
  app.use(json());
  app.use(urlencoded({ extended: true }));


   const swaggerConfig = new DocumentBuilder()
     .setTitle('Subscription Management API')
     .setDescription('API documentation for the subscription management application')
     .setVersion('1.0')
     .build();
   const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);
    await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
