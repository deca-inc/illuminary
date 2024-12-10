import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import { Transformation } from "./parser";
import { Writable } from "stream";
import { readFile } from "fs/promises";
import { removeBackgroundByEdgesPlugin } from "../plugins/simpleRemoveBackground";

export async function applyImageTransformations(
  inputPath: string,
  transformations: Transformation[]
): Promise<Buffer> {
  console.log(transformations);
  let buffer = await readFile(inputPath);

  for (const { type, params } of transformations) {
    switch (type) {
      case "e_background_removal":
        buffer = await removeBackgroundByEdgesPlugin(buffer, params);
        break;

      case "c_fill":
        buffer = await sharp(buffer)
          .resize(params.w as number, params.h as number, { fit: "cover" })
          .toBuffer();
        break;

      case "c_crop":
        buffer = await sharp(buffer)
          .extract({
            width: params.w as number,
            height: params.h as number,
            left: params.x as number,
            top: params.y as number,
          })
          .toBuffer();
        break;

      case "c_pad":
        buffer = await sharp(buffer)
          .resize(params.w as number, params.h as number, {
            fit: "contain",
            background: typeof params.b === "string" ? params.b : "black",
          })
          .toBuffer();
        break;

      case "c_scale": // Updated c_scale
        buffer = await sharp(buffer)
          .resize({
            width: params.w as number | undefined,
            height: params.h as number | undefined,
            fit: "inside", // Respects aspect ratio
          })
          .toBuffer();
        break;

      case "c_thumb":
        buffer = await sharp(buffer)
          .resize(params.w as number, params.h as number, { fit: "cover" })
          .toBuffer();
        break;

      case "c_fit":
        buffer = await sharp(buffer)
          .resize(params.w as number, params.h as number, { fit: "inside" })
          .toBuffer();
        break;

      case "b_auto":
        buffer = await sharp(buffer)
          .flatten({ background: (params.b as string) || "white" })
          .toBuffer();
        break;

      case "ar":
        if (params.w) {
          buffer = await sharp(buffer)
            .resize(
              params.w as number,
              Math.round((params.w as number) / (params.ar as number))
            )
            .toBuffer();
        } else if (params.h) {
          buffer = await sharp(buffer)
            .resize(
              Math.round((params.h as number) * (params.ar as number)),
              params.h as number
            )
            .toBuffer();
        }
        break;

      case "g_auto":
        buffer = await sharp(buffer)
          .resize(params.w as number, params.h as number, { fit: "cover" })
          .toBuffer();
        break;

      case "q_auto":
        buffer = await sharp(buffer)
          .jpeg({ quality: (params.quality as number) || 80 })
          .toBuffer();
        break;

      default:
        console.warn(`Unsupported transformation type: ${type}`);
    }
  }

  return buffer;
}

export async function applyVideoTransformations(
  stream: Writable,
  inputPath: string,
  transformations: Transformation[]
): Promise<Writable> {
  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath);

    transformations.forEach(({ type, params }) => {
      switch (type) {
        case "so": // Start Offset
          command = command.seekInput((params.so as number) || 0);
          break;
        case "eo": // End Offset
          command = command.duration(
            (params.eo as number) - (params.so as number)
          );
          break;
        case "du": // Duration
          command = command.duration(params.du as number);
          break;
        case "c_fill":
          command = command.videoFilters(
            `scale=${params.w}:${params.h}:force_original_aspect_ratio=1`
          );
          break;
        case "c_pad":
          command = command.videoFilters(
            `scale=${params.w}:${params.h},pad=${params.w}:${params.h}:(${params.w}-${params.h})/2`
          );
          break;
        case "c_crop":
          command = command.videoFilters(
            `crop=${params.w}:${params.h}:${params.x}:${params.y}`
          );
          break;
        case "fl_splice":
          command = command
            .input(params.l_video as string)
            .complexFilter("concat=n=2:v=1:a=1");
          break;
        case "b_blurred":
          command = command.videoFilters(
            `boxblur=luma_radius=${params.radius || 10}:chroma_radius=${
              params.radius || 10
            }`
          );
          break;
        case "ar": // Aspect Ratio
          command = command.videoFilters(`scale=${params.ar}`);
          break;
        case "g_auto":
          // Custom logic to detect gravity is needed
          console.warn(
            "g_auto is not supported directly, needs AI implementation."
          );
          break;
        case "q_auto":
          command = command.outputOptions(`-qscale:v ${params.quality || 5}`);
          break;
        default:
          console.warn(`Unsupported transformation type for video: ${type}`);
      }
    });

    try {
      const writable = command.stream(stream);
      resolve(writable);
    } catch (error) {}
  });
}
