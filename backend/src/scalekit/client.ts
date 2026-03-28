import { ScalekitClient } from '@scalekit-sdk/node';
import { env } from '../../config/env';

let _client: ScalekitClient | null = null;

export function getScalekitClient(): ScalekitClient {
  if (!_client) {
    _client = new ScalekitClient(
      env.SCALEKIT_ENV_URL,
      env.SCALEKIT_CLIENT_ID,
      env.SCALEKIT_CLIENT_SECRET
    );
  }
  return _client;
}
