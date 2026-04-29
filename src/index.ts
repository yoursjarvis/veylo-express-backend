import "dotenv/config";

import "@/monitoring/tracing";
import app from "@/app";
import { config } from "@/utils/config";

const PORT = config("app.port");

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
