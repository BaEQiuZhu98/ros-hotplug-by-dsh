import os

from ament_index_python.packages import get_package_share_directory

from launch.actions import DeclareLaunchArgument
from launch import LaunchDescription
from launch_ros.actions import Node
from launch.actions import IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource

def generate_launch_description():
    declare_use_sim_time_cmd = DeclareLaunchArgument(
        'use_sim_time', default_value='False',
    )

    pkg_biadapt_desc = get_package_share_directory('biadapt_description')
    world_sdf = os.path.join(pkg_biadapt_desc, 'sdf', 'biadapt_world.sdf')
    pkg_ros_gz_sim = get_package_share_directory('ros_gz_sim')
    gz_sim = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(pkg_ros_gz_sim, 'launch', 'gz_sim.launch.py')),
        launch_arguments={
            'gz_args': f"-r {world_sdf}"
        }.items(),
    )

    spawn = Node(
        package='ros_gz_sim',
        executable='create',
        parameters=[{'name': 'biadapt', 'topic': '/robot_description'}],
        output='screen',
    )

    bridge = Node(
        package='ros_gz_bridge',
        executable='parameter_bridge',
        arguments=[
            '/cmd_vel@geometry_msgs/msg/Twist@gz.msgs.Twist',
            '/odom@nav_msgs/msg/Odometry@gz.msgs.Odometry',
            '/tf@tf2_msgs/msg/TFMessage@gz.msgs.Pose_V',
            '/clock@rosgraph_msgs/msg/Clock@gz.msgs.Clock',
            '/joint_state@sensor_msgs/msg/JointState[gz.msgs.Model',
            '/scan@sensor_msgs/msg/LaserScan@gz.msgs.LaserScan',
            '/rgbd_camera/image@sensor_msgs/msg/Image@gz.msgs.Image',
            '/rgbd_camera/depth_image@sensor_msgs/msg/Image@gz.msgs.Image',
            '/rgbd_camera/points@sensor_msgs/msg/PointCloud2@gz.msgs.PointCloudPacked',
            '/rgbd_camera/camera_info@sensor_msgs/msg/CameraInfo@gz.msgs.CameraInfo',
        ],
        remappings = [('/joint_state', '/joint_states')],
        output='screen',
    )

    return LaunchDescription([
        declare_use_sim_time_cmd,
        gz_sim,
        spawn,
        bridge,
    ])
