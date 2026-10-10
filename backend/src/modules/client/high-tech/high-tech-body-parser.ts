import { json } from 'express';
import type { Request, RequestHandler } from 'express';

// Drafts and IP exports may contain 200 rows; drafts also include five 20,000-character materials.
// Keep all unrelated endpoints on Nest's default body limit and preserve rawBody.
const parseDraft = json({
  limit: '10mb',
  verify: (request, _response, buffer) => {
    (request as Request & { rawBody?: Buffer }).rawBody = buffer;
  },
});

// Use a distinct middleware name so Nest still registers its default jsonParser.
export const highTechDraftBodyParser: RequestHandler = function highTechDraftBodyParser(request, response, next) {
  const isDraft = request.method === 'PUT' && /^\/client\/companies\/[1-9]\d{0,19}\/high-tech-application\/?$/iu.test(request.path);
  const isIpExport = request.method === 'POST' && /^\/client\/companies\/[1-9]\d{0,19}\/high-tech-application\/(ip-summary|project-details)\/export\/?$/iu.test(request.path);
  const isFieldRecommendation = request.method === 'POST' && /^\/client\/companies\/[1-9]\d{0,19}\/high-tech-application\/tech-fields\/recommend\/?$/iu.test(request.path);
  const isNameGeneration = request.method === 'POST' && /^\/client\/companies\/[1-9]\d{0,19}\/high-tech-application\/names\/generate\/?$/iu.test(request.path);
  const isIpAllocation = request.method === 'POST' && /^\/client\/companies\/[1-9]\d{0,19}\/high-tech-application\/ip-allocation\/preview\/?$/iu.test(request.path);
  if (isDraft || isIpExport || isFieldRecommendation || isNameGeneration || isIpAllocation) {
    parseDraft(request, response, next);
  } else {
    next();
  }
};
