import * as http from 'http';
import * as url from 'url';
import * as net from 'net';
import * as httpProxy from 'http-proxy';

interface IHostPort {
  host: string;
  port: number;
}

class Proxy {
  constructor(port: number) {
    const server: http.Server = http.createServer(this.handleRequest.bind(this));
    server.listen(port);

    server.addListener('connect', this.handleConnection);
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const parsedURL: url.UrlWithStringQuery = url.parse(req.url);
    const target: string = `${parsedURL.protocol}//${parsedURL.host}`;

    if (!Proxy.isHostAllowed(parsedURL.host))
      return res.end();

    const proxy: httpProxy = httpProxy.createProxyServer({ });
    proxy.web(req, res, { target });
  }
  
  private handleConnection(req: http.IncomingMessage, socket: net.Socket, head: Buffer): void {
    try {
      const hostPort: IHostPort = Proxy.parseHostPort(req.url, 443);

      if (!Proxy.isHostAllowed(hostPort.host))
        return socket.end();
      
      const socketProxy: net.Socket = new net.Socket();
      socketProxy.connect(hostPort.port, hostPort.host, () => {
        try {
          socketProxy.write(head);
          socket.write(`HTTP/${req.httpVersion} 200 Connection established\r\n\r\n`);
        } catch (exception) {}
      });

      socketProxy.on('data', chunk => socket.write(chunk));
      socketProxy.on('end', socket.end);
      socketProxy.on('error', socketProxy.end);
      
      socket.on('data', chunk => socketProxy.write(chunk));
      socket.on('end', socketProxy.end);
      socket.on('error', socketProxy.end);
    } catch (exception) {}
  }

  static isHostAllowed(host: string): boolean {
    if (!process.env.ALLOWED_HOSTS)
      return false;

    const allowedHosts: string[] = process.env.ALLOWED_HOSTS.split(',');
    return allowedHosts.includes(host);
  }

  static parseHostPort(host: string, defaultPort: number): IHostPort {
    const split: RegExpExecArray = /^([^:]+)(:([0-9]+))?$/.exec(host);
    let port: number = defaultPort;

    if (split) {
      host = split[1];

      if (split[2])
        port = parseInt(split[3]);
    }

    return { host, port };
  }
}

new Proxy(8080);

process.on('uncaughtException', () => { });
