onBootstrap((e) => {
    $app.logger().info('Initializing custom hooks ...')
    e.next()
})