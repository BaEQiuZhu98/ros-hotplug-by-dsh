cmake_minimum_required(VERSION 3.8)
project(cpp_control)

# 编译优化: 控制循环要快, 开 -O2.
if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -O2)
endif()

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)

add_executable(control_node src/control_node.cpp)
ament_target_dependencies(control_node rclcpp)

install(TARGETS control_node
  DESTINATION lib/${PROJECT_NAME})

ament_package()
