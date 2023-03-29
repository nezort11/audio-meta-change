import { css } from "@emotion/css";
import { Global, css as reactCss } from "@emotion/react";
import { SVGProps, useCallback, useEffect, useMemo, useState } from "react";
import axios, { AxiosError } from "axios";
import { ChangeEvent } from "react";
import {
  FileError,
  useDropzone,
  ErrorCode as ErrorCode_,
  FileRejection,
} from "react-dropzone";

import "./LoadingSpinner.scss";
import axiosRetry from "axios-retry";

const MusicNoteIcon = (svgProps: SVGProps<SVGSVGElement>) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" {...svgProps}>
      <path d="M499.1 6.3c8.1 6 12.9 15.6 12.9 25.7v72V368c0 44.2-43 80-96 80s-96-35.8-96-80s43-80 96-80c11.2 0 22 1.6 32 4.6V147L192 223.8V432c0 44.2-43 80-96 80s-96-35.8-96-80s43-80 96-80c11.2 0 22 1.6 32 4.6V200 128c0-14.1 9.3-26.6 22.8-30.7l320-96c9.7-2.9 20.2-1.1 28.3 5z" />
    </svg>
  );
};

const LoadingSpinner = (svgProps: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      {...svgProps}
      className={`spinner ${svgProps.className || ""}`}
      width="65px"
      height="65px"
      viewBox="0 0 66 66"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        className="path"
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        cx="33"
        cy="33"
        r="30"
      />
    </svg>
  );
};

const inputStyles = {
  outline: "none",
};

enum ErrorCode {
  InvalidImage = "invalid-image",
  ImageNotSquareSize = "image-not-square-size",
  ImageNotWidthRange = "image-not-width-range",
}

const errorMessages: Record<string, string> = {
  [ErrorCode_.FileInvalidType]: "Файл должен быть изображением формата JPEG",
  [ErrorCode_.FileTooLarge]:
    "Изображение больше чем 200КБ, пожалуйста попробуй компрессировать его",
  [ErrorCode_.TooManyFiles]: "Можно загрузить только 1 файл",
  [ErrorCode.InvalidImage]: "Поврежденное JPEG изображение",
  [ErrorCode.ImageNotSquareSize]:
    "Изображение должно быть квадратного размера (ширина равна высоте)",
  [ErrorCode.ImageNotWidthRange]:
    "Ширина изображение должна быть от 64 до 320 пикселей",
};

const getBase64 = (file: File) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (reader.result === null) {
        resolve(undefined);
        return;
      }
      const base64dataUrl = reader.result.toString();
      const base64content = base64dataUrl.replace(/^data:(.*,)?/, "");
      if (base64content.length % 4 > 0) {
        const base64contentWithPadding = `${base64content}${"=".repeat(
          4 - (base64content.length % 4)
        )}`;
        resolve(base64contentWithPadding);
        return;
      }
      resolve(base64content);
    };
    reader.onerror = (error) => reject(error);
  });
};

const getImage = (file: File) => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject();
    image.src = URL.createObjectURL(file);
  });
};

const getDurationFromSeconds = (seconds: number) => {
  const secondsLeft = seconds % 60;
  const minutesLeft = Math.floor(seconds / 60) % 60;
  const hoursLeft = Math.floor(seconds / 3600) % 60;
  return `${hoursLeft > 0 && hoursLeft < 10 ? 0 : ""}${
    hoursLeft > 0 ? hoursLeft + ":" : ""
  }${minutesLeft < 10 ? 0 : ""}${minutesLeft}:${
    secondsLeft < 10 ? 0 : ""
  }${secondsLeft}`;
};

const validateTelegramThumbnail = async (file: File) => {
  let image: HTMLImageElement;
  try {
    image = await getImage(file);
  } catch (error) {
    return ErrorCode.InvalidImage;
  }

  if (image.width !== image.height) {
    return ErrorCode.ImageNotSquareSize;
  }

  if (image.width > 320 || image.width < 64) {
    return ErrorCode.ImageNotWidthRange;
  }

  // Size is greater than 200KB
  if (file.size > 200 * 1024) {
    return ErrorCode_.FileTooLarge;
  }

  return null;
};

axiosRetry(axios, {
  retries: 3,
  retryCondition: (error) => error.response?.status === 511,
});

// Telegram WebApp is old Safari webview (~IE11)
function App() {
  // console.log("urlParams", urlParams);
  const telegramWebapp = useMemo(() => Telegram.WebApp, [Telegram.WebApp]);

  // NOTE: Object.fromEntries is undefined in Telegram WebApp (Safari 14.0)
  const urlParams = useMemo(
    () => new URLSearchParams(window.location.search),
    [window.location.search]
  );
  const defaultDurationSeconds = useMemo(
    () => +(urlParams.get("duration") || 0) || 0,
    [urlParams]
  );
  const defaultDuration = useMemo(
    () => getDurationFromSeconds(defaultDurationSeconds),
    [defaultDurationSeconds]
  );
  const defaultTitle = useMemo(() => urlParams.get("title") || "", [urlParams]);
  const defaultArtist = useMemo(
    () => urlParams.get("artist") || "",
    [urlParams]
  );
  const defaultThumbnail_ = useMemo(
    () => urlParams.get("thumbnail") || "",
    [urlParams]
  );
  const defaultThumbnailFileId = useMemo(
    () => urlParams.get("thumbnailFileId") || "",
    [urlParams]
  );

  const [title, setTitle] = useState<undefined | string>(undefined);
  const [artist, setArtist] = useState<undefined | string>(undefined);
  const [thumbnail, setThumbnail] = useState<undefined | File>(undefined);
  const [fileRejection, setFileRejection] = useState<
    FileRejection | undefined
  >();
  const [defaultThumbnail, setDefaultThumbnail] = useState(defaultThumbnail_);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // const [isChangeDisabled, setIsChangeDisabled] = useState(true);

  const titleValue = useMemo(
    () => (title === undefined ? defaultTitle : title),
    [title, defaultTitle]
  );
  const artistValue = useMemo(
    () => (artist === undefined ? defaultArtist : artist),
    [artist, defaultArtist]
  );
  const thumbnailPreview = useMemo(
    () => (thumbnail ? URL.createObjectURL(thumbnail) : defaultThumbnail),
    [thumbnail, defaultThumbnail]
  );

  const isChangeDisabled = useMemo(
    () =>
      titleValue === defaultTitle &&
      artistValue === defaultArtist &&
      thumbnail === undefined &&
      defaultThumbnail === defaultThumbnail_,
    [
      titleValue,
      defaultTitle,
      artistValue,
      defaultArtist,
      thumbnail,
      defaultThumbnail,
      defaultThumbnail_,
    ]
  );

  const handleTitleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value),
    [setTitle]
  );
  const handleArtistChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setArtist(event.target.value),
    [setArtist]
  );
  const handleDelete = useCallback(() => {
    setDefaultThumbnail("");
    setThumbnail(undefined);
  }, [setThumbnail]);

  // const handleThumbnailChange = useCallback(
  //   (event: ChangeEvent<HTMLInputElement>) =>
  //     event.target.files &&
  //     event.target.files.length > 0 &&
  //     setThumbnail(event.target.files[0]),
  //   [setArtist]
  // );

  const handleDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) {
        return;
      }

      const currentFile = acceptedFiles[0];

      const errorCode = await validateTelegramThumbnail(currentFile);
      if (errorCode !== null) {
        setFileRejection({
          file: currentFile,
          errors: [{ code: errorCode, message: "" }],
        });
        return;
      }

      setThumbnail(currentFile);

      // Set binary file into state
      // setValue("image", currentFile);
      // Set object url into state
      // setFilePreview(URL.createObjectURL(currentFile));
    },
    [setFileRejection, setThumbnail]
  );

  const handleChangeSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}`,
        {
          chatId: urlParams.get("chatId"),
          fileId: urlParams.get("fileId"),
          titleValue,
          artistValue,
          thumbnail: thumbnail ? await getBase64(thumbnail) : "",
          thumbnailFileId: thumbnail ? "" : defaultThumbnailFileId,
          duration: defaultDurationSeconds,
        },
        {
          timeout: 15 * 60 * 1000, // 15 min
          headers: {
            "Bypass-Tunnel-Reminder": true,
          },
        }
      );
      // console.log(response.data);
      telegramWebapp.close();
    } catch (error) {
      console.error(error);
    }
    setIsSubmitting(false);
  }, [title, artist, thumbnail, telegramWebapp, defaultDurationSeconds]);

  const {
    getRootProps,
    getInputProps,
    open,
    fileRejections: dropzoneFileRejections,
    isFileDialogActive,
    isDragActive,
  } = useDropzone({
    accept: { "image/jpeg": [], "image/jpg": [] },
    // maxSize: 200 * 1024, // 200KB
    multiple: false,
    maxFiles: 1,
    // useFsAccessApi: false,
    // validator: telegramThumbnailValidator,
    noClick: true,
    onDrop: handleDrop,
  });

  const fileRejections = useMemo(
    () => [
      ...dropzoneFileRejections,
      ...(fileRejection !== undefined ? [fileRejection] : []),
    ],
    [dropzoneFileRejections, fileRejection]
  );

  const handleOpen = useCallback(() => {
    setFileRejection(undefined);
    open();
  }, [setFileRejection, open]);

  useEffect(() => {
    telegramWebapp.expand();
  }, [telegramWebapp]);

  // @ts-ignore
  // console.log("window.Telegram.WebApp", window.Telegram);

  return (
    <>
      <Global
        styles={reactCss({
          "*": {
            boxSizing: "border-box",
          },
          body: {
            padding: 16,
            margin: 0,
            fontFamily: "sans-serif",
            background: telegramWebapp.themeParams.bg_color,
            color: telegramWebapp.themeParams.text_color,
            fontSize: "16px",
          },
          button: {
            border: "none",
            outline: "none",
            background: telegramWebapp.themeParams.button_color,
            color: telegramWebapp.themeParams.button_text_color,
            fontSize: "14px",
            cursor: "pointer",
            borderRadius: "8px",
            padding: "8px 12px",

            "&:hover": {
              filter: "brightness(110%);",
            },
          },
          input: {
            outline: 0,
            background: telegramWebapp.themeParams.bg_color,
            color: telegramWebapp.themeParams.text_color,
            border: `1px solid ${telegramWebapp.themeParams.text_color}`,
            borderRadius: "8px",
            fontSize: "14px",
            padding: "8px",
            width: "100%",
            transition: "0.3s",

            "&:hover": {
              borderColor: telegramWebapp.themeParams.button_color,
              filter: "brightness(120%);",
            },
            "&:focus": {
              borderColor: telegramWebapp.themeParams.button_color,
              filter: "brightness(100%);",
            },
          },
        })}
      />
      <div
        {...getRootProps()}
        className={css({ height: "93vh", outline: "none" })}
      >
        <input {...getInputProps()} />

        <div className={css({ marginBottom: 16 })}>
          <div className={css({ marginBottom: 4 })}>
            <label className={css({ fontWeight: 600 })}>Название</label>
          </div>

          <input
            type="text"
            autoComplete="off"
            value={titleValue}
            onChange={handleTitleChange}
            className={css({ ...inputStyles })}
          />
        </div>
        <div className={css({ marginBottom: 16 })}>
          <div className={css({ marginBottom: 4 })}>
            <label className={css({ fontWeight: 600 })}>Автор</label>
          </div>

          <input
            type="text"
            autoComplete="off"
            value={artistValue}
            onChange={handleArtistChange}
            className={css({ ...inputStyles })}
          />
        </div>
        <div className={css({ marginBottom: 16 })}>
          <div className={css({ marginBottom: 8 })}>
            <label className={css({ fontWeight: 600 })}>Миниатюра</label>
          </div>

          <button
            onClick={thumbnailPreview ? handleDelete : handleOpen}
            className={css({
              marginBottom: 8,
              // ...(thumbnail && { background: "#DC143C" }),
            })}
          >
            {!thumbnailPreview && !isFileDialogActive && "Загрузить миниатюру"}
            {!thumbnailPreview && isFileDialogActive && "Выбери миниатюру"}
            {thumbnailPreview && "Удалить миниатюру"}
          </button>

          <div className={css({ color: "#DC143C" })}>
            {fileRejections.length > 0 &&
              fileRejections[0].errors.map((error) => (
                <div key={error.message} className={css({ fontSize: "14px" })}>
                  {errorMessages[error.code as string]}
                </div>
              ))}
          </div>

          <div
            className={css({
              fontSize: "14px",
              marginTop: 8,
              display: thumbnailPreview ? "none" : "block",
            })}
          >
            Формат JPEG (
            <span className={css({ fontFamily: "monospace, monospace" })}>
              .jpg
            </span>
            ,{" "}
            <span className={css({ fontFamily: "monospace, monospace" })}>
              .jpeg
            </span>
            ), квадратный размер (ширина=высота), ширина/высота от{" "}
            <span className={css({ fontFamily: "monospace, monospace" })}>
              64
            </span>{" "}
            до{" "}
            <span className={css({ fontFamily: "monospace, monospace" })}>
              320
            </span>{" "}
            пикселей, максимальный размер{" "}
            <span className={css({ fontFamily: "monospace, monospace" })}>
              200
            </span>{" "}
            КБ
          </div>
        </div>

        <div
          className={css({
            display: "flex",
            alignItems: "center",
            background: `${telegramWebapp.themeParams.button_color}88`,
            padding: "8px 12px",
            borderRadius: 16,
            marginBottom: 16,
          })}
        >
          {thumbnailPreview ? (
            <img
              src={thumbnailPreview}
              className={css({
                width: 40,
                height: 40,
                marginRight: 8,
                borderRadius: "50%",
              })}
            />
          ) : (
            <div
              className={css({
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: 40,
                height: 40,
                marginRight: 8,
                borderRadius: "50%",
                background: telegramWebapp.themeParams.button_color,
              })}
            >
              <MusicNoteIcon
                className={css({
                  width: 22,
                  height: 22,
                  path: { fill: "#FFFFFF" },
                })}
              />
            </div>
          )}

          <div
            className={css({
              fontSize: "14px",
            })}
          >
            <div
              className={css({
                fontWeight: 600,
                marginBottom: 4,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                // width: "100%",
                maxWidth: "70vw",
              })}
            >
              {titleValue} - {artistValue}
            </div>
            <div>{defaultDuration}</div>
          </div>
        </div>

        <button
          onClick={handleChangeSubmit}
          disabled={isChangeDisabled}
          className={css({
            padding: "12px 16px",
            width: "100%",
            fontWeight: 600,
            height: 40,
            maxHeight: 40,
            position: "relative",

            ...(isChangeDisabled && {
              // background: `${telegramWebapp.themeParams.button_color}33`,
              filter: "brightness(80%);",
              cursor: "default",
              transitionDuration: "0.3s",
              "&:hover": {
                filter: "brightness(80%);",
              },
            }),
            ...(isSubmitting && {
              cursor: "default",
              "&:hover": {
                filter: "brightness(100%);",
              },
            }),
          })}
        >
          {isSubmitting ? (
            <LoadingSpinner
              className={css({
                position: "absolute",
                top: -12,
                left: "calc(50% - 16px)",
                width: 18,
                circle: { stroke: telegramWebapp.themeParams.text_color },
              })}
            />
          ) : (
            "Изменить"
          )}
        </button>
      </div>
    </>
  );
}

export default App;
