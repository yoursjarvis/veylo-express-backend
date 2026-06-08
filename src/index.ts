import "dotenv/config";

import app from "@/app";
import "@/app/workers/index";
import "@/monitoring/tracing";
import { config } from "@/utils/config";

const PORT = config("app.port");

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
