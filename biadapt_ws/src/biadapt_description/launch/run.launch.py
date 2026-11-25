import os
import xacro

from ament_index_python.packages import get_package_share_directory

from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration, Command
from launch import LaunchDescription
from launch_ros.actions import Node
from launch.actions import IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch_ros.parameter_descriptions import ParameterValue
from launch.conditions import IfCondition

def generate_launch_description():
    declare_debug_enable_cmd = DeclareLaunchArgument(
        'debug_enable', default_value='False',
    )

    pkg_biadapt_desc = get_package_share_directory('biadapt_description')
    xacro_path = os.path.join(pkg_biadapt_desc, 'urdf', 'BiAdaptRobot.xacro')
    params = {
        'robot_description': ParameterValue(
            Command(['xacro ', xacro_path, ' debug_enable:=', LaunchConfiguration('debug_enable')]),
            value_type=str,
        ),
        'use_sim_time': ParameterValue(LaunchConfiguration('use_sim_time'), value_type=bool),
    }
    declare_use_sim_time_cmd = DeclareLaunchArgument(
        'use_sim_time', default_value='True',
    )

    node_robot_state_publisher = Node(
        package='robot_state_publisher',
        executable='robot_state_publisher',
        output='screen',
        parameters=[params],
    )

    launch_dir = os.path.join(pkg_biadapt_desc, "launch")

    declare_run_rviz_cmd = DeclareLaunchArgument(
        'run_rviz', default_value='True',
    )
    run_rviz = LaunchConfiguration('run_rviz')
    run_rviz_cmd = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(os.path.join(launch_dir, 'rviz.launch.py')),
        condition=IfCondition(run_rviz),
        launch_arguments={
            'use_sim_time': LaunchConfiguration('use_sim_time'),
            'debug_enable': LaunchConfiguration('debug_enable'),
        }.items()
    )

    declare_run_gazebo_cmd = DeclareLaunchArgument(
        'run_gazebo', default_value='True',
    )
    run_gazebo = LaunchConfiguration('run_gazebo')
    run_gazebo_cmd = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(os.path.join(launch_dir, 'gazebo.launch.py')),
        condition=IfCondition(run_gazebo),
        launch_arguments={
            'use_sim_time': LaunchConfiguration('use_sim_time'),
            'debug_enable': LaunchConfiguration('debug_enable'),
        }.items()
    )

    return LaunchDescription([
        declare_debug_enable_cmd,
        declare_use_sim_time_cmd,
        node_robot_state_publisher,
        declare_run_rviz_cmd,
        run_rviz_cmd,
        declare_run_gazebo_cmd,
        run_gazebo_cmd,
    ])