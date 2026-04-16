/**
 * Validate a URL is a valid YouTube URL.
 */
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    const youtubeHost = parsed.hostname === 'www.youtube.com' || parsed.hostname === 'youtube.com' || parsed.hostname === 'youtu.be';
    return youtubeHost;
  } catch {
    return false;
  }
}

/**
 * Validate video input body. Returns array of error strings (empty if valid).
 * NOTE: `duration` arrives as total seconds (integer), already computed
 * by the frontend from the minutes + seconds inputs.
 */
function validateVideo(body) {
  const errors = [];

  if (!body.title || typeof body.title !== 'string' || body.title.length > 200) {
    errors.push('Title is required (max 200 chars)');
  }
  if (!body.source_url || !isValidUrl(body.source_url)) {
    errors.push('Valid YouTube URL is required');
  }

  const duration = Number(body.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    errors.push('Duration must be a positive number of seconds');
  }

  return errors;
}

/**
 * Express middleware that validates video body.
 */
function validateVideoBody(req, res, next) {
  const errors = validateVideo(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  next();
}

module.exports = { validateVideo, validateVideoBody, isValidUrl };
