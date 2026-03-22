const fs = require("fs");

class AutoRollback {
  constructor(errorThreshold = 20) {
    this.errorThreshold = errorThreshold;
    this.rollbackHistory = [];
  }

  checkAndRollback(currentErrorRatePercent) {
    const errorRate = parseFloat(currentErrorRatePercent);

    if (errorRate > this.errorThreshold) {
      console.log(`\n[ALERT] ERROR RATE ${errorRate}% EXCEEDS THRESHOLD ${this.errorThreshold}%`);
      console.log("[ACTION] INITIATING AUTO-ROLLBACK TO STABLE...\n");

      try {
        const configData = fs.readFileSync("./config.json", "utf8");
        const config = JSON.parse(configData);

        const previousMode = config.mode;

        if (previousMode !== "stable") {
          config.mode = "stable";

          fs.writeFileSync("./config.json", JSON.stringify(config, null, 2), "utf8");

          const rollbackEvent = {
            timestamp: new Date().toISOString(),
            previousMode: previousMode,
            newMode: "stable",
            errorRate: errorRate,
            threshold: this.errorThreshold,
          };

          this.rollbackHistory.push(rollbackEvent);

          console.log(`[SUCCESS] ROLLBACK COMPLETED`);
          console.log(`[INFO] Previous mode: ${previousMode}`);
          console.log(`[INFO] New mode: stable`);
          console.log(`[INFO] Error rate was: ${errorRate}%\n`);

          return {
            success: true,
            rolled: true,
            previousMode: previousMode,
            newMode: "stable",
            errorRate: errorRate,
            timestamp: rollbackEvent.timestamp,
          };
        } else {
          return {
            success: true,
            rolled: false,
            message: "Already in stable mode, no rollback needed",
            errorRate: errorRate,
          };
        }
      } catch (err) {
        console.error("[ERROR] ROLLBACK FAILED:", err.message);
        return {
          success: false,
          error: err.message,
        };
      }
    }

    return {
      success: true,
      rolled: false,
      errorRate: errorRate,
      timestamp: new Date().toISOString(),
    };
  }

  getRollbackHistory() {
    return this.rollbackHistory;
  }

  getStats() {
    return {
      threshold: this.errorThreshold,
      rollbackCount: this.rollbackHistory.length,
      lastRollback: this.rollbackHistory.length > 0 ? this.rollbackHistory[this.rollbackHistory.length - 1] : null,
      history: this.rollbackHistory,
    };
  }

  manualRollback() {
    try {
      const configData = fs.readFileSync("./config.json", "utf8");
      const config = JSON.parse(configData);

      const previousMode = config.mode;
      config.mode = "stable";

      fs.writeFileSync("./config.json", JSON.stringify(config, null, 2), "utf8");

      console.log(`[ACTION] MANUAL ROLLBACK: ${previousMode} to stable`);

      return {
        success: true,
        previousMode: previousMode,
        newMode: "stable",
      };
    } catch (err) {
      console.error("[ERROR] Manual rollback failed:", err.message);
      return {
        success: false,
        error: err.message,
      };
    }
  }
}

module.exports = AutoRollback;