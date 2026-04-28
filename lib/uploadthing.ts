import {
  createRouteHandler,
  createUploadthing,
  type FileRouter,
} from "uploadthing/next";

import { getRequiredSession } from "@/lib/auth";

const f = createUploadthing();

export const uploadRouter = {
  purchaseBill: f({
    image: {
      maxFileCount: 1,
      maxFileSize: "4MB",
    },
  })
    .middleware(async () => {
      const session = await getRequiredSession(["partner"]);

      if (!session) {
        throw new Error("Unauthorized");
      }

      return { uploadedBy: session.user.id };
    })
    .onUploadComplete(({ file, metadata }) => ({
      uploadedBy: metadata.uploadedBy,
      url: file.ufsUrl,
    })),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;

export const { GET, POST } = createRouteHandler({
  router: uploadRouter,
});
