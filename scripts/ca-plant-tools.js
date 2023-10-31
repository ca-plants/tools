#!/usr/bin/env node

import { DataLoader } from "@ca-plant-list/ca-plant-list";
import { Tools } from "../lib/tools.js";

await Tools.run( DataLoader );
