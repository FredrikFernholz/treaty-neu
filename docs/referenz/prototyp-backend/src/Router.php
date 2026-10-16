<?php
declare(strict_types=1);

namespace Treaty;

/**
 * Minimaler Router ohne Framework-Abhängigkeit: Pfad-Muster mit {param}-Platzhaltern, zugeordnet
 * auf [ControllerKlasse, Methodenname]. Reicht für eine schlanke REST-API ohne Middleware-Stack.
 */
final class Router
{
    /** @var array<int, array{method:string, pattern:string, regex:string, params:string[], handler:array}> */
    private array $routes = [];

    public function add(string $method, string $pattern, array $handler): void
    {
        $paramNames = [];
        $regex = preg_replace_callback('#\{([a-zA-Z_]+)\}#', function ($m) use (&$paramNames) {
            $paramNames[] = $m[1];
            return '([^/]+)';
        }, $pattern);
        $this->routes[] = [
            'method' => $method,
            'pattern' => $pattern,
            'regex' => '#^' . $regex . '$#',
            'params' => $paramNames,
            'handler' => $handler,
        ];
    }

    public function get(string $pattern, array $handler): void { $this->add('GET', $pattern, $handler); }
    public function post(string $pattern, array $handler): void { $this->add('POST', $pattern, $handler); }
    public function put(string $pattern, array $handler): void { $this->add('PUT', $pattern, $handler); }
    public function delete(string $pattern, array $handler): void { $this->add('DELETE', $pattern, $handler); }

    public function dispatch(string $method, string $path): void
    {
        $path = '/' . trim($path, '/');
        $matchedPattern = false;
        foreach ($this->routes as $route) {
            if (!preg_match($route['regex'], $path, $m)) {
                continue;
            }
            if ($route['method'] !== $method) {
                $matchedPattern = true;
                continue;
            }
            array_shift($m);
            $args = array_combine($route['params'], $m);
            [$class, $action] = $route['handler'];
            $controller = new $class();
            $body = self::readJsonBody();
            $controller->$action($args, $body);
            return;
        }
        if ($matchedPattern) {
            Response::error('Methode für diesen Pfad nicht erlaubt.', 405);
        }
        Response::error('Nicht gefunden.', 404);
    }

    public static function readJsonBody(): array
    {
        $raw = file_get_contents('php://input');
        if ($raw === '' || $raw === false) {
            return [];
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }
}
