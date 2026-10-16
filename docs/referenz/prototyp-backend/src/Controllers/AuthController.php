<?php
declare(strict_types=1);

namespace Treaty\Controllers;

use Treaty\Auth;
use Treaty\Response;

final class AuthController extends BaseController
{
    public function login(array $args, array $body): void
    {
        $this->requireFields($body, ['login', 'password']);
        $m = Auth::login((string) $body['login'], (string) $body['password']);
        if ($m === null) {
            Response::error('Anmeldedaten ungültig.', 401);
        }
        Response::json(['mitarbeiter' => $m]);
    }

    public function logout(array $args, array $body): void
    {
        Auth::logout();
        Response::json(['ok' => true]);
    }

    public function me(array $args, array $body): void
    {
        $m = Auth::current();
        if ($m === null) {
            Response::error('Nicht angemeldet.', 401);
        }
        Response::json(['mitarbeiter' => $m]);
    }
}
