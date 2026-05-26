import { model, models, Schema } from "mongoose";

const historyEventSchema = new Schema(
  {
    actorId: { type: String, required: true, index: true },
    actorName: { type: String, required: true },
    actorRole: { type: String, required: true },
    module: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    entityLabel: { type: String, required: true },
    action: { type: String, required: true, index: true },
    summary: { type: String, required: true },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  },
);

historyEventSchema.index({ createdAt: -1 });

const HistoryEventModel =
  models.HistoryEvent || model("HistoryEvent", historyEventSchema);

export default HistoryEventModel;
