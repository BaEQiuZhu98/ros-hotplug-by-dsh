import os

from ament_index_python.packages import get_package_share_directory

from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch import LaunchDescription
from launch_ros.actions import Node

def generate_launch_description():
    pkg_biadapt_desc = get_package_share_directory('biadapt_description')
    declare_use_sim_time_cmd = DeclareLaunchArgument(
        'use_sim_time', default_value='False',
    )

    node_joint_state_publisher_gui = Node(
        package='joint_state_publisher_gui',
        executable='joint_state_publisher_gui',
        parameters=[{
            'use_sim_time': LaunchConfiguration('use_sim_time'),
        }]
    )

    node_rviz = Node(
        package='rviz2',
        executable='rviz2',
        arguments=['-d', os.path.join(pkg_biadapt_desc, 'launch', 'display.rviz')],
        parameters=[{
            'use_sim_time': LaunchConfiguration('use_sim_time'),
        }]
    )

    return LaunchDescription([
        declare_use_sim_time_cmd,
        node_joint_state_publisher_gui,
        node_rviz,
    ])