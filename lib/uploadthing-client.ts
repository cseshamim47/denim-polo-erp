"use client";

import { genUploader } from "uploadthing/client";

import type { UploadRouter } from "@/lib/uploadthing";

export const uploadThingClient = genUploader<UploadRouter>({
  url: "/api/uploadthing",
});
