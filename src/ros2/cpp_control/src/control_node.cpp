// cpp_control - C++ 高频控制循环(阶段 0 固化, 由 demo/11 的 control_node.cpp 升级而来).
//
// 高频定时器跑一个 PID, 并实测: 实际频率、抖动、单次计算耗时.
// 用 C++ 写控制循环, 目标频率能更接近 1000 Hz, 抖动更小, 单次计算快 1~2 个数量级.
// 这就是机器人控制层(实时、高频率)基本都用 C++ 的原因.
//
// 与 eval/robot 的关系: 本节点的实测数字是对照 §11.2 公开基线(1kHz / 抖动 μs 级)的
// 被测对象; 数值必须实测, 禁止预填.

#include <chrono>
#include <cmath>
#include <vector>

#include "rclcpp/rclcpp.hpp"

class ControlLoop : public rclcpp::Node {
public:
  explicit ControlLoop(double rate_hz)
      : Node("control_cpp"), target_period_(1.0 / rate_hz) {
    // wall timer: 每 target_period_ 秒触发一次 tick.
    timer_ = this->create_wall_timer(
        std::chrono::duration<double>(target_period_),
        [this]() { this->tick(); });
  }

private:
  void tick() {
    auto t0 = std::chrono::steady_clock::now();

    // ---- 假装的控制计算: PID 跟踪目标 1.0(和 demo/11 Python 版完全相同) ----
    // 教学取舍: 积分项用目标周期 target_period_ 而非实测间隔(实测间隔见下方抖动统计);
    // 对恒定目标频率演示足够, 更严格的实现应按每次 tick 的真实 dt 积分.
    double err = 1.0 - q_;
    integral_ += err * target_period_;
    q_ += (20.0 * err + 40.0 * integral_) * target_period_;
    // ---- 计算结束 ----

    auto t1 = std::chrono::steady_clock::now();
    if (have_last_) {
      intervals_.push_back(std::chrono::duration<double>(t1 - last_).count());
      compute_times_.push_back(std::chrono::duration<double>(t1 - t0).count());
      if (intervals_.size() >= 2000) {
        report();
      }
    }
    last_ = t1;
    have_last_ = true;
  }

  void report() {
    double sum_i = 0.0, sum_c = 0.0;
    for (double v : intervals_) sum_i += v;
    for (double v : compute_times_) sum_c += v;
    double avg = sum_i / static_cast<double>(intervals_.size());
    double avg_c = sum_c / static_cast<double>(compute_times_.size());
    // 抖动 = 间隔的标准差.
    double var = 0.0;
    for (double v : intervals_) var += (v - avg) * (v - avg);
    double jitter = std::sqrt(var / static_cast<double>(intervals_.size()));
    RCLCPP_INFO(this->get_logger(),
                "实际频率 %.0f Hz (目标 1000 Hz), 抖动 %.3f ms, 单次计算 %.3f ms",
                1.0 / avg, jitter * 1000.0, avg_c * 1000.0);
    intervals_.clear();
    compute_times_.clear();
  }

  rclcpp::TimerBase::SharedPtr timer_;
  double target_period_;
  double q_ = 0.0;
  double integral_ = 0.0;
  std::chrono::steady_clock::time_point last_;
  bool have_last_ = false;
  std::vector<double> intervals_;
  std::vector<double> compute_times_;
};

int main(int argc, char **argv) {
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<ControlLoop>(1000.0));
  rclcpp::shutdown();
  return 0;
}
