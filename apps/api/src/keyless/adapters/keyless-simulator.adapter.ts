import { Injectable, Logger } from '@nestjs/common';
import { KeylessAction, KeylessOperationStatus } from '@prisma/client';

export interface KeylessExecutionResult {
  status: KeylessOperationStatus;
  deviceResult: string;
}

@Injectable()
export class KeylessSimulatorAdapter {
  private readonly logger = new Logger(KeylessSimulatorAdapter.name);

  /**
   * Giả lập gửi lệnh điều khiển tới thiết bị IoT gắn trên ô tô.
   */
  async executeCommand(
    action: KeylessAction,
    plateNormalized: string,
    simulateResult?: 'SUCCESS' | 'FAILED' | 'UNKNOWN',
  ): Promise<KeylessExecutionResult> {
    const isTest = process.env.NODE_ENV === 'test';

    // Giả lập độ trễ viễn thông IoT 20-50ms (nếu không phải môi trường test)
    if (!isTest) {
      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    // Xác định kết quả mô phỏng (hỗ trợ test mode qua tham số simulateResult)
    const outcome = simulateResult || 'SUCCESS';

    this.logger.log(
      `[KeylessSimulator] Executed ${action} on vehicle ${plateNormalized} -> result: ${outcome}`,
    );

    if (outcome === 'SUCCESS') {
      return {
        status: KeylessOperationStatus.SUCCESS,
        deviceResult: JSON.stringify({
          plate: plateNormalized,
          doors: action === KeylessAction.UNLOCK ? 'UNLOCKED' : 'LOCKED',
          batteryPercent: 92,
          odometerKm: 15420,
          lat: 10.7769,
          lng: 106.7009,
          signalStrengthDbm: -68,
          timestamp: new Date().toISOString(),
          statusText: action === KeylessAction.UNLOCK ? 'Cửa xe đã mở chốt' : 'Cửa xe đã khóa chốt',
        }),
      };
    }

    if (outcome === 'UNKNOWN') {
      return {
        status: KeylessOperationStatus.UNKNOWN,
        deviceResult: JSON.stringify({
          plate: plateNormalized,
          error: 'TIMEOUT',
          message: 'Mất tín hiệu kết nối IoT tới hộp đen xe (có thể do đỗ tầng hầm)',
          signalStrengthDbm: -115,
          timestamp: new Date().toISOString(),
        }),
      };
    }

    return {
      status: KeylessOperationStatus.FAILED,
      deviceResult: JSON.stringify({
        plate: plateNormalized,
        error: 'HARDWARE_FAULT',
        message: 'Lỗi cơ khí: Chốt cửa xe bị kẹt hoặc cửa đang hé mở',
        timestamp: new Date().toISOString(),
      }),
    };
  }

  /**
   * Giả lập đối soát (reconcile) trạng thái thiết bị cho các lệnh UNKNOWN hoặc PENDING.
   */
  async reconcileCommand(
    action: KeylessAction,
    plateNormalized: string,
  ): Promise<KeylessExecutionResult> {
    this.logger.log(`[KeylessSimulator] Reconciled ${action} on vehicle ${plateNormalized}`);
    return {
      status: KeylessOperationStatus.SUCCESS,
      deviceResult: JSON.stringify({
        plate: plateNormalized,
        doors: action === KeylessAction.UNLOCK ? 'UNLOCKED' : 'LOCKED',
        reconciled: true,
        reconciledAt: new Date().toISOString(),
        statusText: 'Đã đối soát thành công qua sóng GSM khẩn cấp',
      }),
    };
  }
}
