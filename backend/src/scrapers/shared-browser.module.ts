import { Module, Global } from '@nestjs/common';
import { SharedBrowserService } from './shared-browser.service';

@Global() // Make this service available globally
@Module({
  providers: [SharedBrowserService],
  exports: [SharedBrowserService],
})
export class SharedBrowserModule {}
