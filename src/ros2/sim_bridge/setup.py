from setuptools import setup

package_name = 'sim_bridge'

setup(
    name=package_name,
    version='0.1.0',
    packages=[package_name],
    data_files=[
        # ament 索引标记: 让 ros2 pkg / ros2 run 能找到本包.
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='BaEQiuZhu98',
    maintainer_email='1095897362@qq.com',
    description='MuJoCo two-arm simulator bridge (contract v1.0)',
    license='MIT',
    entry_points={
        'console_scripts': [
            # 运行: ros2 run sim_bridge two_arm_server [--view] [--model PATH].
            'two_arm_server = sim_bridge.two_arm_server:main',
        ],
    },
)
