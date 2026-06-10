import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { mailQueue } from "@/app/queues/mail.queue";
import { mediaQueue } from "@/app/queues/media.queue";

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [
    new BullMQAdapter(mailQueue),
    new BullMQAdapter(mediaQueue),
  ],
  serverAdapter: serverAdapter,
});

export { serverAdapter as bullBoardAdapter };
