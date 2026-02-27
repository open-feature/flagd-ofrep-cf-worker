import { OfrepHandler } from '@openfeature/flagd-ofrep-cf-worker';
import flags from '../../src/flags.json';

export const config = {
  runtime: 'edge',
};

const ofrepHandler = new OfrepHandler({
  flags,
  basePath: '/api/ofrep/v1',
});

export default async function ofrep(request: Request): Promise<Response> {
  return ofrepHandler.handleRequest(request);
}
