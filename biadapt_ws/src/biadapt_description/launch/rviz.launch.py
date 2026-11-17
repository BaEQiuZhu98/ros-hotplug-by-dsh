import os
import xacro

from ament_index_python.packages import get_package_share_directory

from launch import LaunchDescription
from launch_ros.actions import Node

def generate_launch_description():
    pkg_biadapt_desc = get_package_share_directory('biadapt_description')

    node_joint_state_publisher_gui = Node(
        package='joint_state_publisher_gui',
        executable='joint_state_publisher_gui'
    )

    node_rviz = Node(
        package='rviz2',
        executable='rviz2',
       arguments=['-d', os.path.join(pkg_biadapt_desc, 'launch', 'display.rviz')],
    )

    return LaunchDescription([
        node_joint_state_publisher_gui,
        node_rviz,
    ])