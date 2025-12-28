import { Module, Global } from '@nestjs/common';
import { SharedBrowserService } from './shared-browser.service';
import { BrightDataService } from './brightdata.service';

@Global() // Make this service available globally
@Module({
  providers: [SharedBrowserService,BrightDataService],
  exports: [SharedBrowserService,BrightDataService],
})
export class SharedBrowserModule {}
