const debug = require("debug")("StaticMaps-gl.imageUtils");
const sharp = require("sharp");

debug("simd available: " + sharp.simd(true));

exports.parseImageFormat = function(format) {
  var imageFormat;
  var mimetype;
  var imageOptions = {};

  if (format.startsWith("png")) {
    mimetype = "image/png";
    imageFormat = "png";
  } else if (format.startsWith("jpeg") || format.startsWith("jpg")) {
    mimetype = "image/jpeg";
    imageFormat = "jpeg";
  } else if (format.startsWith("webp")) {
    mimetype = "image/webp";
    imageFormat = "webp";
  } else {
    throw "Invalid image format: " + format;
  }

  if (imageFormat == "jpeg" || imageFormat == "webp") {
    if (format.endsWith("70")) {
      imageOptions["quality"] = 70;
    } else if (format.endsWith("80")) {
      imageOptions["quality"] = 80;
    } else if (format.endsWith("90")) {
      imageOptions["quality"] = 90;
    } else if (format.endsWith("100")) {
      imageOptions["quality"] = 100;
    }
  } else if (imageFormat == "png") {
    imageOptions["adaptiveFiltering"] = false;
    imageOptions["progressive"] = false;
    imageOptions["compressionLevel"] = 9;
  }

  return {
    format: imageFormat,
    mimetype,
    options: imageOptions
  };
};

exports.sendImageResponse = function(res, width, height, data, imageFormat) {
  const start = Date.now();
  const image = sharp(data, {
    raw: {
      width: width,
      height: height,
      channels: 4
    }
  });

  var formattedImage;
  if (imageFormat.format == "png") {
    formattedImage = image.png(imageFormat.options);
  } else if (imageFormat.format == "jpeg") {
    formattedImage = image.jpeg(imageFormat.options);
  } else if (imageFormat.format == "webp") {
    formattedImage = image.webp(imageFormat.options);
  }

  formattedImage.toBuffer(function(err, data, info) {
    debug("Saving image complete in " + (Date.now() - start) + "ms");
    res.type(imageFormat.mimetype);
    res.send(data);
  });
};
