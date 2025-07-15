import { Controller, Post, Req, Res } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    rawBody: Buffer;
  }
}

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('stripe')
  async handleStripeWebhook(@Req() req: Request, @Res() res: Response) {
    try {
      const sig = req.headers['stripe-signature'];

      await this.webhookService.handleEvent(req.rawBody, sig as string);

      return res.status(200).send();
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
}
