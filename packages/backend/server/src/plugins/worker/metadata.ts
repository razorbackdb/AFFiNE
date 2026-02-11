import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  Logger,
  Query,
  Req,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';

import { Config, safeFetch, UseNamedGuard } from '../../base';
import { Public } from '../../core/auth';
import { WorkerService } from './service';
import { isOriginAllowed, isRefererAllowed } from './utils';

@Public()
@UseNamedGuard('selfhost')
@Controller('/api/worker/metadata')
export class MetadataProxyController {
  private readonly logger = new Logger(MetadataProxyController.name);

  constructor(
    private readonly config: Config,
    private readonly service: WorkerService
  ) {}

  private get allowedOrigin() {
    return this.service.allowedOrigins;
  }

  private checkAccess(req: ExpressRequest) {
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const originAllowed = origin
      ? isOriginAllowed(origin, this.allowedOrigin)
      : false;
    const refererAllowed = referer
      ? isRefererAllowed(referer, this.allowedOrigin)
      : false;
    if (!originAllowed && !refererAllowed) {
      this.logger.error('Invalid Origin', { origin, referer });
      throw new BadRequestException('Invalid header');
    }
  }

  private async proxyRequest(url: URL, serviceName: string) {
    let response;
    try {
      response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'AFFiNE-Metadata-Proxy/1.0',
        },
      });
    } catch (e) {
      this.logger.error(`${serviceName} Proxy fetch failed`, e);
      throw new HttpException(`${serviceName} Fetch failed: ${e}`, 502);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error(
        `${serviceName} API error: ${response.status} ${response.statusText} - ${text}`
      );
      throw new HttpException(
        `${serviceName} API error: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    try {
      return await response.json();
    } catch (e) {
      this.logger.error(`${serviceName} Response parse failed`, e);
      throw new HttpException(`${serviceName} Invalid JSON response`, 502);
    }
  }

  @Get('/tmdb/*')
  async tmdbProxy(@Req() req: ExpressRequest, @Query() query: any) {
    this.checkAccess(req);

    // Manually extract path
    const prefix = '/api/worker/metadata/tmdb/';
    const path = req.path.startsWith(prefix)
      ? req.path.slice(prefix.length)
      : req.params[0];

    this.logger.log(
      `TMDB Proxy Request: full_path='${req.path}', extracted='${path}'`
    );

    const apiKey = this.config.worker.tmdbApiKey;
    if (!apiKey) {
      throw new BadRequestException('TMDB API key is not configured on server');
    }

    const url = new URL(`https://api.themoviedb.org/3/${path}`);
    Object.entries(query).forEach(([key, value]) => {
      if (key !== 'api_key') {
        url.searchParams.set(key, value as string);
      }
    });
    url.searchParams.set('api_key', apiKey);

    this.logger.log(
      `TMDB Proxy Upstream URL: ${url.toString().replace(apiKey, '***')}`
    );

    return this.proxyRequest(url, 'TMDB');
  }

  @Get('/rawg/*')
  async rawgProxy(@Req() req: ExpressRequest, @Query() query: any) {
    this.checkAccess(req);

    // Manually extract path
    const prefix = '/api/worker/metadata/rawg/';
    const path = req.path.startsWith(prefix)
      ? req.path.slice(prefix.length)
      : req.params[0];

    this.logger.log(
      `RAWG Proxy Request: full_path='${req.path}', extracted='${path}'`
    );

    const apiKey = this.config.worker.rawgApiKey;
    if (!apiKey) {
      throw new BadRequestException('RAWG API key is not configured on server');
    }

    const url = new URL(`https://api.rawg.io/api/${path}`);
    Object.entries(query).forEach(([key, value]) => {
      if (key !== 'key') {
        url.searchParams.set(key, value as string);
      }
    });
    url.searchParams.set('key', apiKey);

    return this.proxyRequest(url, 'RAWG');
  }

  @Get('/google-books/*')
  async googleBooksProxy(@Req() req: ExpressRequest, @Query() query: any) {
    this.checkAccess(req);

    // Manually extract path
    const prefix = '/api/worker/metadata/google-books/';
    const path = req.path.startsWith(prefix)
      ? req.path.slice(prefix.length)
      : req.params[0];

    this.logger.log(
      `Google Books Proxy Request: full_path='${req.path}', extracted='${path}'`
    );

    const apiKey = this.config.worker.googleBooksApiKey;

    const url = new URL(`https://www.googleapis.com/books/v1/${path}`);
    Object.entries(query).forEach(([key, value]) => {
      if (key !== 'key') {
        url.searchParams.set(key, value as string);
      }
    });
    if (apiKey) {
      url.searchParams.set('key', apiKey);
    }

    return this.proxyRequest(url, 'Google Books');
  }

  @Get('/lastfm')
  async lastfmProxy(@Req() req: ExpressRequest, @Query() query: any) {
    this.checkAccess(req);

    // Debug config loading
    this.logger.log(
      `Worker Config Keys: ${Object.keys(this.config.worker).join(', ')}`
    );
    if (this.config.worker.lastfmApiKey) {
      this.logger.log(
        `LastFM Key loaded: ${this.config.worker.lastfmApiKey.substring(0, 4)}...`
      );
    } else {
      this.logger.error('LastFM Key is MISSING in config.worker');
    }

    const apiKey = this.config.worker.lastfmApiKey;
    if (!apiKey) {
      throw new BadRequestException(
        'LastFM API key is not configured on server'
      );
    }

    const url = new URL('https://ws.audioscrobbler.com/2.0/');
    Object.entries(query).forEach(([key, value]) => {
      if (key !== 'api_key') {
        url.searchParams.set(key, value as string);
      }
    });
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('format', 'json');

    return this.proxyRequest(url, 'LastFM');
  }
}
